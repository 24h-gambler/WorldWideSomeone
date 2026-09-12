/**
 * 앱 상태 (zustand + AsyncStorage). 서버 없는 MVP: 봇 행동은 scheduled 이벤트로 시뮬.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  AppNotification,
  Chat,
  FriendRequest,
  Gender,
  Inventory,
  LatLng,
  Letter,
  Passby,
  Place,
  ScheduledEvent,
  Settings,
  TargetFilter,
  User,
  VehicleId,
} from '@/types';
import { BOT_GREETINGS, BOT_REPLIES, WEATHERS, makeBots } from '@/data/bots';
import { VEHICLE_MAP } from '@/data/vehicles';
import { describePlace, destinationPoint, distanceKm, bearingDeg, randomLandPoint } from '@/engine/geo';
import { pushLocal } from '@/engine/notify';
import {
  LANDED_RADIUS_KM,
  LANDED_WINDOW_MS,
  PASSBY_RADIUS_KM,
  aimRouteAt,
  catchWindowMs,
  minDistanceBetween,
  planFlight,
  positionOf,
  progressOf,
} from '@/engine/sim';

export const BOTS: User[] = makeBots();
const BOT_BY_ID: Record<string, User> = Object.fromEntries(BOTS.map((b) => [b.id, b]));

export const ME_ID = 'me';

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export const PRICES = {
  shield: { coins: 60, qty: 3, name: '방어권 ×3', emoji: '🛡️', desc: '편지 1통을 장난(반환·바다·우주)에서 1회 지켜요' },
  ufo: { coins: 90, qty: 1, name: 'UFO 티켓', emoji: '🛸', desc: '지그재그 초고속 비행, 잡기 창 2배, 모두의 시선' },
  route: { coins: 60, qty: 3, name: '경로 지정 ×3', emoji: '🧭', desc: '경유지를 최대 3곳 찍어 원하는 하늘을 지나가요' },
  orbit: { coins: 150, qty: 1, name: '궤도 위성', emoji: '🛰️', desc: '지구를 3바퀴 돌며 가장 많은 사람에게 노출' },
} as const;

export type ItemKey = keyof typeof PRICES;

const DEFAULT_ME: User = {
  id: ME_ID,
  nickname: '',
  avatar: '🦊',
  bio: '',
  field: 'IT/개발',
  gender: 'private',
  job: '학생',
  hobbies: [],
  location: { lat: 37.5665, lng: 126.978, city: '서울', country: '대한민국' },
  isBot: false,
  lastActiveAt: Date.now(),
  stats: { sent: 0, caught: 0, distanceKm: 0 },
  stamps: [],
  coins: 120,
  inventory: { shield: 1, ufo: 0, route: 0, orbit: 0 },
  premium: false,
};

const DEFAULT_SETTINGS: Settings = { timeScale: 120, notifications: true, devMode: false, haptics: true };

type ComposeInput = {
  text: string;
  imageUri?: string;
  destination?: LatLng; // 없으면 랜덤
  waypoints?: LatLng[];
  vehicle: VehicleId;
  target: TargetFilter;
  useShield: boolean;
};

export type State = {
  onboarded: boolean;
  me: User;
  letters: Letter[];
  friendIds: string[];
  requests: FriendRequest[];
  chats: Chat[];
  notifications: AppNotification[];
  passbys: Passby[];
  scheduled: ScheduledEvent[];
  settings: Settings;
  lastTick: number;
  // transient
  focusLetterId: string | null;

  // actions
  completeOnboarding: (p: { nickname: string; avatar: string; field: string; gender: Gender; job: string; hobbies: string[]; location: Place }) => void;
  updateProfile: (patch: Partial<User>) => void;
  setLocation: (p: Place) => void;
  setSettings: (patch: Partial<Settings>) => void;
  sendLetter: (input: ComposeInput) => Letter;
  catchLetter: (letterId: string) => Letter | undefined;
  redirectLetter: (letterId: string, action: 'returned' | 'ocean' | 'space') => 'defended' | 'done' | 'immune';
  dismissPassby: (id: string) => void;
  sendFriendRequest: (toId: string, letterId?: string) => void;
  acceptRequest: (id: string) => void;
  declineRequest: (id: string) => void;
  sendMessage: (otherId: string, text: string) => boolean;
  markChatRead: (otherId: string) => void;
  markNotificationsRead: () => void;
  buy: (item: ItemKey) => boolean;
  buyPremium: () => boolean;
  setFocusLetter: (id: string | null) => void;
  tick: (now: number) => void;
  devFastForward: (ms: number) => void;
  devSpawnPassby: () => void;
  resetAll: () => void;
};

export function getUser(state: Pick<State, 'me'>, id: string): User | undefined {
  if (id === ME_ID) return state.me;
  return BOT_BY_ID[id];
}

export function matchesTarget(u: User, t: TargetFilter): boolean {
  if (t.field && u.field !== t.field) return false;
  if (t.gender && u.gender !== t.gender) return false;
  if (t.job && u.job !== t.job) return false;
  if (t.hobby && !u.hobbies.includes(t.hobby)) return false;
  return true;
}

function notif(type: AppNotification['type'], title: string, body: string, route?: string): AppNotification {
  return { id: uid(), type, title, body, at: Date.now(), read: false, route };
}

/** 봇 발신 편지 하나 생성 (aimAt이 있으면 그 위치 상공을 지나가도록) */
function makeBotLetter(bot: User, aimAt: LatLng | null, timeScale: number, startProgress = 0): Letter {
  const vehicles: VehicleId[] = ['paper', 'paper', 'pigeon', 'balloon', 'prop', 'jet', 'rocket', 'ufo', 'satellite'];
  const vehicle = pick(vehicles);
  let destPt: LatLng;
  if (aimAt) {
    // 봇 → 사용자 방향으로 사용자 너머 500~2500km 지점을 목적지로 → 대권이 사용자 상공을 지남
    const brg = bearingDeg(bot.location, aimAt);
    const jitter = destinationPoint(aimAt, Math.random() * 360, rand(0, 40));
    destPt = aimRouteAt(bot.location, destinationPoint(jitter, brg, rand(500, 2500)), [], vehicle, aimAt);
  } else {
    destPt = randomLandPoint();
  }
  const destination = describePlace(destPt);
  const plan = planFlight(bot.location, destPt, [], vehicle, timeScale);
  const now = Date.now();
  const departedAt = now - plan.durationMs * startProgress;
  const texts = [
    '지금 이 편지를 읽는 당신, 오늘 하루 어땠나요?',
    '여기 하늘은 오렌지색이에요. 거기는요?',
    '아무나 잡아줘요. 심심해요.',
    '나는 새벽에 이걸 접었어요. 누구에게 갈지 궁금하네요.',
    '만약 이걸 잡았다면, 당신은 운이 좋은 사람.',
    '커피 한 잔 값의 용기로 보냅니다 ☕',
    '내 고양이가 방금 이 위를 지나갔어요. 발자국이 있다면 그거예요.',
    '우리 언제 한번 만날 수 있을까요? 아니면 편지로만.',
  ];
  return {
    id: uid(),
    senderId: bot.id,
    text: pick(texts),
    origin: bot.location,
    destination,
    randomDestination: !aimAt,
    waypoints: [],
    vehicle,
    shield: Math.random() < 0.2,
    target: {},
    status: 'flying',
    departedAt,
    arrivesAt: departedAt + plan.durationMs,
    distanceKm: plan.distanceKm,
    events: [{ type: 'departed', at: departedAt, place: bot.location.city }],
    stamp: bot.location.city,
  };
}

function fillTemplate(s: string, bot: User) {
  return s.replace('{city}', bot.location.city).replace('{weather}', pick(WEATHERS));
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false,
      me: DEFAULT_ME,
      letters: [],
      friendIds: [],
      requests: [],
      chats: [],
      notifications: [],
      passbys: [],
      scheduled: [],
      settings: DEFAULT_SETTINGS,
      lastTick: Date.now(),
      focusLetterId: null,

      completeOnboarding: (p) => {
        const me: User = { ...get().me, ...p, lastActiveAt: Date.now() };
        const ts = get().settings.timeScale;
        // 초기 월드: 봇 편지 9개, 그중 3개는 1~3분 내 내 머리 위 통과
        const letters: Letter[] = [];
        const shuffled = [...BOTS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 9; i++) {
          const bot = shuffled[i];
          const aim = i < 3;
          let letter = makeBotLetter(bot, aim ? me.location : null, ts, aim ? 0 : rand(0.05, 0.7));
          if (aim) {
            // 사용자 상공 도달 시점을 60~180초 뒤로 맞춤
            const dToUser = distanceKm(bot.location, me.location);
            const pAtUser = Math.min(0.95, dToUser / letter.distanceKm);
            const dur = letter.arrivesAt - letter.departedAt;
            const eta = rand(60_000, 180_000) + i * 40_000;
            const departedAt = Date.now() + eta - pAtUser * dur;
            letter = { ...letter, departedAt, arrivesAt: departedAt + dur };
          }
          letters.push(letter);
        }
        set({
          onboarded: true,
          me,
          letters,
          scheduled: [{ id: uid(), at: Date.now() + 30_000, type: 'bot_send', payload: {} }],
          notifications: [notif('reward', '환영해요! 🌍', '첫 편지를 접어 하늘로 날려보세요. 곧 누군가의 편지도 머리 위를 지나갈 거예요.')],
        });
      },

      updateProfile: (patch) => set((s) => ({ me: { ...s.me, ...patch } })),
      setLocation: (p) => set((s) => ({ me: { ...s.me, location: p } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setFocusLetter: (id) => set({ focusLetterId: id }),

      sendLetter: (input) => {
        const s = get();
        const ts = s.settings.timeScale;
        const destPt = input.destination ?? randomLandPoint();
        const destination = describePlace(destPt);
        const waypoints = input.waypoints ?? [];
        const plan = planFlight(s.me.location, destPt, waypoints, input.vehicle, ts);
        const now = Date.now();
        const v = VEHICLE_MAP[input.vehicle];
        const inv: Inventory = { ...s.me.inventory };
        if (input.useShield && inv.shield > 0) inv.shield -= 1;
        if (v.premiumItem === 'ufo') inv.ufo = Math.max(0, inv.ufo - 1);
        if (v.premiumItem === 'orbit') inv.orbit = Math.max(0, inv.orbit - 1);
        if (waypoints.length > 0) inv.route = Math.max(0, inv.route - 1);

        const letter: Letter = {
          id: uid(),
          senderId: ME_ID,
          text: input.text,
          imageUri: input.imageUri,
          origin: s.me.location,
          destination,
          randomDestination: !input.destination,
          waypoints,
          vehicle: input.vehicle,
          shield: input.useShield && s.me.inventory.shield > 0,
          target: input.target,
          status: 'flying',
          departedAt: now,
          arrivesAt: now + plan.durationMs,
          distanceKm: plan.distanceKm,
          events: [{ type: 'departed', at: now, place: s.me.location.city }],
          stamp: s.me.location.city,
        };

        // 봇 반응 예약
        const sched: ScheduledEvent[] = [];
        const candidates = BOTS.filter((b) => matchesTarget(b, input.target));
        const nearDest = candidates
          .map((b) => ({ b, d: distanceKm(b.location, destPt) }))
          .sort((x, y) => x.d - y.d);
        const catcher = nearDest[0] && (nearDest[0].d < 2500 || Math.random() < 0.35) ? nearDest[0].b : null;
        if (catcher && Math.random() < 0.9) {
          sched.push({
            id: uid(),
            at: letter.arrivesAt + rand(15_000, 70_000),
            type: 'bot_catch',
            payload: { letterId: letter.id, botId: catcher.id },
          });
        }
        if (!v.immune && Math.random() < 0.12) {
          sched.push({
            id: uid(),
            at: now + plan.durationMs * rand(0.3, 0.7),
            type: 'bot_mischief',
            payload: { letterId: letter.id, botId: pick(BOTS).id },
          });
        }
        set({
          letters: [letter, ...s.letters],
          scheduled: [...s.scheduled, ...sched],
          me: {
            ...s.me,
            inventory: inv,
            coins: s.me.coins + 2,
            stats: { ...s.me.stats, sent: s.me.stats.sent + 1, distanceKm: s.me.stats.distanceKm + Math.round(plan.distanceKm) },
          },
          focusLetterId: letter.id,
        });
        return letter;
      },

      catchLetter: (letterId) => {
        const s = get();
        const letter = s.letters.find((l) => l.id === letterId);
        if (!letter || letter.status === 'caught') return letter;
        const now = Date.now();
        const place = s.me.location.city;
        const updated: Letter = {
          ...letter,
          status: 'caught',
          caughtBy: ME_ID,
          caughtAt: now,
          catchPlace: place,
          events: [...letter.events, { type: 'caught', at: now, by: ME_ID, place }],
        };
        const stamps = s.me.stamps.includes(letter.stamp) ? s.me.stamps : [...s.me.stamps, letter.stamp];
        set({
          letters: s.letters.map((l) => (l.id === letterId ? updated : l)),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'caught' } : p)),
          me: { ...s.me, stamps, coins: s.me.coins + 10, stats: { ...s.me.stats, caught: s.me.stats.caught + 1 } },
          notifications: [notif('reward', '+10 코인 🪙', `${letter.stamp}에서 온 편지를 잡았어요`), ...s.notifications],
        });
        return updated;
      },

      redirectLetter: (letterId, action) => {
        const s = get();
        const letter = s.letters.find((l) => l.id === letterId);
        if (!letter) return 'done';
        const now = Date.now();
        const v = VEHICLE_MAP[letter.vehicle];
        if (v.immune) {
          set({ passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) });
          return 'immune';
        }
        if (letter.shield) {
          set({
            letters: s.letters.map((l) =>
              l.id === letterId
                ? { ...l, shield: false, events: [...l.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] }
                : l,
            ),
            passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)),
          });
          return 'defended';
        }
        set({
          letters: s.letters.map((l) =>
            l.id === letterId
              ? { ...l, status: action, events: [...l.events, { type: action, at: now, by: ME_ID, place: s.me.location.city }] }
              : l,
          ),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: action } : p)),
          me: { ...s.me, coins: s.me.coins + 1 },
        });
        return 'done';
      },

      dismissPassby: (id) =>
        set((s) => ({ passbys: s.passbys.map((p) => (p.id === id && !p.resolved ? { ...p, resolved: 'missed' } : p)) })),

      sendFriendRequest: (toId, letterId) => {
        const s = get();
        if (s.friendIds.includes(toId) || s.requests.some((r) => r.fromId === ME_ID && r.toId === toId && r.status === 'pending')) return;
        const req: FriendRequest = { id: uid(), fromId: ME_ID, toId, letterId, status: 'pending', createdAt: Date.now() };
        const chats = s.chats.some((c) => c.otherId === toId)
          ? s.chats
          : [{ id: toId, otherId: toId, messages: [], lastReadAt: Date.now() }, ...s.chats];
        const sched: ScheduledEvent[] = [...s.scheduled];
        if (BOT_BY_ID[toId] && Math.random() < 0.88) {
          sched.push({ id: uid(), at: Date.now() + rand(8_000, 35_000), type: 'bot_accept', payload: { requestId: req.id } });
        }
        set({ requests: [req, ...s.requests], chats, scheduled: sched });
      },

      acceptRequest: (id) => {
        const s = get();
        const req = s.requests.find((r) => r.id === id);
        if (!req) return;
        const other = req.fromId === ME_ID ? req.toId : req.fromId;
        const chats = s.chats.some((c) => c.otherId === other)
          ? s.chats
          : [{ id: other, otherId: other, messages: [], lastReadAt: Date.now() }, ...s.chats];
        set({
          requests: s.requests.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r)),
          friendIds: s.friendIds.includes(other) ? s.friendIds : [...s.friendIds, other],
          chats,
          me: { ...s.me, coins: s.me.coins + 20 },
          notifications: [notif('reward', '+20 코인 🪙', '새 친구가 생겼어요! 운송수단 해금을 확인해보세요'), ...s.notifications],
        });
      },

      declineRequest: (id) =>
        set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, status: 'declined' } : r)) })),

      sendMessage: (otherId, text) => {
        const s = get();
        const isFriend = s.friendIds.includes(otherId);
        const chat = s.chats.find((c) => c.otherId === otherId) ?? { id: otherId, otherId, messages: [], lastReadAt: Date.now() };
        const mine = chat.messages.filter((m) => m.senderId === ME_ID).length;
        if (!isFriend && mine >= 3) return false;
        const msg = { id: uid(), senderId: ME_ID, text, at: Date.now() };
        const updated: Chat = { ...chat, messages: [...chat.messages, msg], lastReadAt: Date.now() };
        const chats = s.chats.some((c) => c.otherId === otherId) ? s.chats.map((c) => (c.otherId === otherId ? updated : c)) : [updated, ...s.chats];
        const sched = [...s.scheduled];
        if (BOT_BY_ID[otherId]) {
          sched.push({ id: uid(), at: Date.now() + rand(3_000, 12_000), type: 'bot_chat', payload: { botId: otherId } });
        }
        set({ chats, scheduled: sched });
        return true;
      },

      markChatRead: (otherId) =>
        set((s) => ({ chats: s.chats.map((c) => (c.otherId === otherId ? { ...c, lastReadAt: Date.now() } : c)) })),

      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      buy: (item) => {
        const s = get();
        const price = PRICES[item];
        if (s.me.coins < price.coins) return false;
        const inv = { ...s.me.inventory, [item]: s.me.inventory[item] + price.qty };
        set({ me: { ...s.me, coins: s.me.coins - price.coins, inventory: inv } });
        return true;
      },

      buyPremium: () => {
        const s = get();
        if (s.me.premium || s.me.coins < 300) return false;
        set({
          me: {
            ...s.me,
            premium: true,
            coins: s.me.coins - 300,
            inventory: { shield: s.me.inventory.shield + 3, ufo: s.me.inventory.ufo + 1, route: s.me.inventory.route + 3, orbit: s.me.inventory.orbit + 1 },
          },
        });
        return true;
      },

      /** 1초 게임 틱: 착륙/만료, 통과 판정, 봇 스케줄 처리 */
      tick: (now) => {
        const s = get();
        if (!s.onboarded) return;
        const prev = s.lastTick;
        let letters = s.letters;
        let passbys = s.passbys;
        let notifications = s.notifications;
        let requests = s.requests;
        let chats = s.chats;
        let friendIds = s.friendIds;
        let me = s.me;
        let scheduled = s.scheduled;
        let changed = false;
        const pushes: { title: string; body: string }[] = [];

        // 1) 착륙 / 만료
        letters = letters.map((l) => {
          if (l.status === 'flying' && now >= l.arrivesAt) {
            changed = true;
            const nearMe = distanceKm(l.destination, me.location) <= LANDED_RADIUS_KM;
            if (l.senderId === ME_ID) {
              notifications = [notif('landed', `📍 ${l.destination.city}에 착륙`, `편지가 도착했어요. 누군가 집어갈 때까지 기다려요`, `/letter/${l.id}`), ...notifications];
            } else if (nearMe && !passbys.some((p) => p.letterId === l.id)) {
              const canCatch = matchesTarget(me, l.target);
              passbys = [{ id: uid(), letterId: l.id, at: now, expiresAt: now + LANDED_WINDOW_MS, canCatch }, ...passbys];
              notifications = [notif('passby', `📍 근처에 편지가 착륙했어요`, `${l.origin.city}에서 온 ${VEHICLE_MAP[l.vehicle].name}. 집어가 볼까요?`, `/catch/${l.id}`), ...notifications];
              pushes.push({ title: '📍 근처에 편지가 착륙했어요', body: `${l.origin.city}에서 온 편지를 집어가세요` });
            }
            return { ...l, status: 'landed', landedAt: now, events: [...l.events, { type: 'landed', at: now, place: l.destination.city }] };
          }
          if (l.status === 'landed' && l.landedAt && now - l.landedAt > LANDED_WINDOW_MS * (l.senderId === ME_ID ? 3 : 1)) {
            // 아무도 안 집어감 → 만료 (내 편지는 봇이 잡을 시간을 더 줌)
            const pending = scheduled.some((e) => e.type === 'bot_catch' && e.payload.letterId === l.id);
            if (pending) return l;
            changed = true;
            return { ...l, status: 'expired', events: [...l.events, { type: 'expired', at: now }] };
          }
          return l;
        });

        // 2) 통과 판정 (봇 편지가 내 상공 150km 이내)
        for (const l of letters) {
          if (l.status !== 'flying' || l.senderId === ME_ID) continue;
          if (passbys.some((p) => p.letterId === l.id)) continue;
          const d = minDistanceBetween(l, prev, now, me.location);
          if (d <= PASSBY_RADIUS_KM) {
            changed = true;
            const canCatch = matchesTarget(me, l.target);
            const v = VEHICLE_MAP[l.vehicle];
            passbys = [{ id: uid(), letterId: l.id, at: now, expiresAt: now + catchWindowMs(l.vehicle), canCatch }, ...passbys];
            const title = `${v.emoji} ${v.name}가 머리 위를 지나가요!`;
            const body = canCatch ? `${l.origin.city}에서 출발한 편지. 지금 잡아보세요` : `조건이 맞는 사람만 잡을 수 있는 편지예요 (구경만)`;
            notifications = [notif('passby', title, body, `/catch/${l.id}`), ...notifications];
            pushes.push({ title, body });
            letters = letters.map((x) => (x.id === l.id ? { ...x, events: [...x.events, { type: 'passby', at: now, place: me.location.city }] } : x));
          }
        }

        // 3) 잡기 창 만료
        passbys = passbys.map((p) => {
          if (!p.resolved && now > p.expiresAt) {
            changed = true;
            return { ...p, resolved: 'missed' as const };
          }
          return p;
        });
        if (passbys.length > 40) passbys = passbys.slice(0, 40);

        // 4) 봇 스케줄
        const due = scheduled.filter((e) => e.at <= now);
        if (due.length) {
          changed = true;
          scheduled = scheduled.filter((e) => e.at > now);
          for (const e of due) {
            switch (e.type) {
              case 'bot_send': {
                const bot = pick(BOTS);
                const activeBot = letters.filter((l) => l.status === 'flying' && l.senderId !== ME_ID).length;
                if (activeBot < 14) {
                  const aim = Math.random() < 0.45;
                  letters = [makeBotLetter(bot, aim ? me.location : null, s.settings.timeScale), ...letters];
                }
                scheduled.push({ id: uid(), at: now + rand(25_000, 60_000), type: 'bot_send', payload: {} });
                break;
              }
              case 'bot_catch': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = BOT_BY_ID[e.payload.botId];
                if (!l || !bot || (l.status !== 'landed' && l.status !== 'flying')) break;
                letters = letters.map((x) =>
                  x.id === l.id
                    ? { ...x, status: 'caught', caughtBy: bot.id, caughtAt: now, catchPlace: bot.location.city, events: [...x.events, { type: 'caught', at: now, by: bot.id, place: bot.location.city }] }
                    : x,
                );
                notifications = [notif('caught', `🎉 ${bot.location.city}에서 누군가 내 편지를 잡았어요`, `??? 님이 ${VEHICLE_MAP[l.vehicle].name}를 잡았어요. 곧 연락이 올지도!`, `/letter/${l.id}`), ...notifications];
                pushes.push({ title: `🎉 ${bot.location.city}에서 누군가 내 편지를 잡았어요`, body: '곧 친구 요청이 올지도 몰라요' });
                me = { ...me, coins: me.coins + 5 };
                if (Math.random() < 0.72 && !friendIds.includes(bot.id)) {
                  scheduled.push({ id: uid(), at: now + rand(12_000, 45_000), type: 'bot_friend_request', payload: { botId: bot.id, letterId: l.id } });
                }
                break;
              }
              case 'bot_friend_request': {
                const bot = BOT_BY_ID[e.payload.botId];
                if (!bot || friendIds.includes(bot.id) || requests.some((r) => r.fromId === bot.id && r.status === 'pending')) break;
                requests = [{ id: uid(), fromId: bot.id, toId: ME_ID, letterId: e.payload.letterId, status: 'pending', createdAt: now }, ...requests];
                const greeting = { id: uid(), senderId: bot.id, text: fillTemplate(pick(BOT_GREETINGS), bot), at: now };
                const existing = chats.find((c) => c.otherId === bot.id);
                chats = existing
                  ? chats.map((c) => (c.otherId === bot.id ? { ...c, messages: [...c.messages, greeting] } : c))
                  : [{ id: bot.id, otherId: bot.id, messages: [greeting], lastReadAt: 0 }, ...chats];
                notifications = [notif('friend_request', '👋 ??? 님이 친구가 되고 싶어해요', `${bot.location.city}에서 내 편지를 잡은 사람이에요`, '/friends'), ...notifications];
                pushes.push({ title: '👋 누군가 친구가 되고 싶어해요', body: `${bot.location.city}에서 내 편지를 잡은 사람` });
                break;
              }
              case 'bot_accept': {
                const req = requests.find((r) => r.id === e.payload.requestId);
                if (!req || req.status !== 'pending') break;
                const bot = BOT_BY_ID[req.toId];
                requests = requests.map((r) => (r.id === req.id ? { ...r, status: 'accepted' } : r));
                if (!friendIds.includes(req.toId)) friendIds = [...friendIds, req.toId];
                me = { ...me, coins: me.coins + 20 };
                const hello = { id: uid(), senderId: req.toId, text: bot ? fillTemplate(pick(BOT_GREETINGS), bot) : '안녕!', at: now };
                chats = chats.some((c) => c.otherId === req.toId)
                  ? chats.map((c) => (c.otherId === req.toId ? { ...c, messages: [...c.messages, hello] } : c))
                  : [{ id: req.toId, otherId: req.toId, messages: [hello], lastReadAt: 0 }, ...chats];
                notifications = [notif('friend_accepted', `🤝 ${bot?.nickname ?? '???'} 님과 친구가 됐어요`, `이제 50km 반경 위치가 서로 공유돼요. +20 코인`, `/chat/${req.toId}`), ...notifications];
                pushes.push({ title: `🤝 ${bot?.nickname ?? '???'} 님과 친구가 됐어요`, body: '지구에서 친구 위치를 확인해보세요' });
                break;
              }
              case 'bot_chat': {
                const bot = BOT_BY_ID[e.payload.botId];
                if (!bot) break;
                const reply = { id: uid(), senderId: bot.id, text: fillTemplate(pick(BOT_REPLIES), bot), at: now };
                chats = chats.map((c) => (c.otherId === bot.id ? { ...c, messages: [...c.messages, reply] } : c));
                notifications = [notif('chat', `💬 ${friendIds.includes(bot.id) ? bot.nickname : '???'}`, reply.text, `/chat/${bot.id}`), ...notifications];
                break;
              }
              case 'bot_mischief': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = BOT_BY_ID[e.payload.botId];
                if (!l || l.status !== 'flying') break;
                if (l.shield) {
                  letters = letters.map((x) => (x.id === l.id ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: bot?.id, place: bot?.location.city }] } : x));
                  notifications = [notif('defended', '🛡️ 방어권이 장난을 막았어요', `누군가 편지를 바다에 빠뜨리려 했지만 튕겨냈어요`, `/letter/${l.id}`), ...notifications];
                  pushes.push({ title: '🛡️ 방어권이 장난을 막았어요', body: '편지는 무사히 비행 중' });
                } else {
                  const action = pick(['returned', 'ocean', 'space'] as const);
                  letters = letters.map((x) => (x.id === l.id ? { ...x, status: action, events: [...x.events, { type: action, at: now, by: bot?.id, place: bot?.location.city }] } : x));
                  const msg = action === 'ocean' ? '😱 내 편지가 바다에 빠졌어요' : action === 'space' ? '🚀 내 편지가 우주로 날아갔어요' : '↩️ 내 편지가 되돌아오고 있어요';
                  notifications = [notif('mischief', msg, '방어권을 장착하면 막을 수 있어요', '/store'), ...notifications];
                  pushes.push({ title: msg, body: '방어권으로 막을 수 있어요' });
                }
                break;
              }
            }
          }
        }
        if (!scheduled.some((e) => e.type === 'bot_send')) {
          scheduled.push({ id: uid(), at: now + 30_000, type: 'bot_send', payload: {} });
          changed = true;
        }

        // 정리: 오래된 봇 편지 제거
        if (letters.length > 80) {
          const keep = letters.filter((l) => l.senderId === ME_ID || l.status === 'flying' || (l.caughtBy === ME_ID) || now - (l.landedAt ?? l.arrivesAt) < 3_600_000);
          if (keep.length !== letters.length) {
            letters = keep;
            changed = true;
          }
        }
        if (notifications.length > 60) notifications = notifications.slice(0, 60);

        if (s.settings.notifications) for (const p of pushes) pushLocal(p.title, p.body);
        if (changed) set({ letters, passbys, notifications, requests, chats, friendIds, me, scheduled, lastTick: now });
        else set({ lastTick: now });
      },

      devFastForward: (ms) =>
        set((s) => ({
          letters: s.letters.map((l) => (l.status === 'flying' ? { ...l, departedAt: l.departedAt - ms, arrivesAt: l.arrivesAt - ms } : l)),
          scheduled: s.scheduled.map((e) => ({ ...e, at: e.at - ms })),
          lastTick: s.lastTick - ms,
        })),

      devSpawnPassby: () => {
        const s = get();
        const bot = pick(BOTS);
        const l = makeBotLetter(bot, s.me.location, s.settings.timeScale);
        const dToUser = distanceKm(bot.location, s.me.location);
        const pAtUser = Math.min(0.95, dToUser / l.distanceKm);
        const dur = l.arrivesAt - l.departedAt;
        const departedAt = Date.now() + 4_000 - pAtUser * dur;
        set({ letters: [{ ...l, departedAt, arrivesAt: departedAt + dur }, ...s.letters] });
      },

      resetAll: () =>
        set({
          onboarded: false,
          me: DEFAULT_ME,
          letters: [],
          friendIds: [],
          requests: [],
          chats: [],
          notifications: [],
          passbys: [],
          scheduled: [],
          settings: DEFAULT_SETTINGS,
          focusLetterId: null,
          lastTick: Date.now(),
        }),
    }),
    {
      name: 'wws-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { focusLetterId, ...rest } = s as any;
        return rest;
      },
    },
  ),
);

// ---- 셀렉터 헬퍼 ----
export const selectFriendCount = (s: State) => s.friendIds.length;
export const selectUnread = (s: State) => s.notifications.filter((n) => !n.read).length;
export const selectActivePassbys = (s: State) => s.passbys.filter((p) => !p.resolved && p.expiresAt > Date.now());
export const selectPendingIncoming = (s: State) => s.requests.filter((r) => r.toId === ME_ID && r.status === 'pending');
export const selectUnreadChats = (s: State) =>
  s.chats.filter((c) => c.messages.some((m) => m.senderId !== ME_ID && m.at > c.lastReadAt)).length;
export const displayName = (s: Pick<State, 'me' | 'friendIds'>, id: string) => {
  if (id === ME_ID) return s.me.nickname || '나';
  return s.friendIds.includes(id) ? getUser(s, id)?.nickname ?? '???' : '???';
};
export { progressOf, positionOf };
