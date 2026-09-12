/**
 * 앱 상태 v4 (zustand + AsyncStorage). 로컬 모드에서는 봇 스케줄러가 세계를 돌린다.
 * 흐름: 편지 → 잡기(프로필 공개) → 답장(상대 배달원 · 코인으로 가속 가능) → 수락 → 친구 + 실시간 채팅
 * 비회원: 둘러보기·잡기·엿보기는 가능, 보내기/좋아요/댓글/채팅/결제는 가입 게이트.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppNotification, Auth, AuthProvider, Chat, Gender, Inventory, LatLng, Letter, LetterKind, Passby, PermissionState, Place, PlanId, Post, ScheduledEvent, Settings, TargetFilter, User, VehicleId } from '@/types';
import { BOT_COMMENTS, BOT_GREETINGS, BOT_LETTERS, BOT_POSTS, BOT_REPLIES, BOT_REPLIES_LETTER, WEATHERS, makeBots } from '@/data/bots';
import { SNAIL, VEHICLES, VEHICLE_MAP, bestVehicle, vehicleUnlocked } from '@/data/vehicles';
import { AVATARS } from '@/data/profile';
import { COIN_REWARDS, DAILY_FREE_COIN_CAP, ITEM_MAP, OCEAN_RESCUE_COINS, OCEAN_SINK_MS, PACK_MAP, PLAN_MAP, REPLY_BOOST, SHIELD_PER_FRIENDS, discounted, rentalCoins, type BoostTier, type ItemId, type PackId } from '@/data/plans';
import { bearingDeg, describePlace, destinationPoint, distanceKm, fuzzToGrid, randomLandPoint } from '@/engine/geo';
import { pushLocal } from '@/engine/notify';
import { LANDED_RADIUS_KM, LANDED_WINDOW_MS, PASSBY_RADIUS_KM, aimRouteAt, appendTrail, applySnail, catchWindowMs, closestProgress, minDistanceBetween, planFlight, positionOf, progressOf, pullTo, rerouteThrough, resurface, seedTrail, speedUp } from '@/engine/sim';
import { track } from '@/services/analytics';

export const BOTS: User[] = makeBots();
const BOT_BY_ID: Record<string, User> = Object.fromEntries(BOTS.map((b) => [b.id, b]));
export const ME_ID = 'me';
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const today = () => new Date().toDateString();
const thisMonth = () => new Date().toISOString().slice(0, 7);

const DEFAULT_INV: Inventory = { shield: 1, ufo: 0, orbit: 0, peek: 1, pull: 0, direct: 0, carpet: 0 };
const DEFAULT_ME: User = {
  id: ME_ID, nickname: '', avatar: '🦊', bio: '', field: 'IT/개발', gender: 'private', job: '학생', hobbies: [],
  location: { lat: 37.5665, lng: 126.978, city: '서울', country: '대한민국' }, isBot: false, lastActiveAt: Date.now(),
  stats: { sent: 0, received: 0, caught: 0, distanceKm: 0, likes: 0 }, stamps: [], coins: 100, inventory: DEFAULT_INV, quota: { date: '', peeks: 0, pulls: 0, earned: 0, month: '', direct: 0 },
  plan: 'free', shieldMilestone: 0, createdAt: Date.now(), auth: { provider: 'guest' },
};
const DEFAULT_SETTINGS: Settings = { timeScale: 240, notifications: true, haptics: true, devMode: false, backgroundLocation: false, theme: 'system' };

export type ComposeInput = {
  text: string; imageUri?: string; destination?: LatLng; waypoints?: LatLng[]; vehicle: VehicleId; target: TargetFilter; useShield: boolean; isPublic: boolean; shareToStory?: boolean;
  replyToId?: string; recipientId?: string; friendRequest?: boolean; kind?: LetterKind;
  direct?: boolean;  // 직행 편지(결제): recipientId 필수 · 무조건 도착
  rent?: boolean;    // 잠긴 배달원을 코인으로 1회 대여
};
export type Permissions = { location: PermissionState; backgroundLocation: PermissionState; notifications: PermissionState; pushToken?: string };
export type ActionResult = 'done' | 'defended' | 'immune' | 'limit' | 'quota' | 'nofunds' | 'gone';
export type ProfileInput = { nickname: string; avatar: string; bio: string; field: string; gender: Gender; job: string; hobbies: string[] };

export type State = {
  onboarded: boolean; signedIn: boolean; tourDone: boolean; deviceId: string;
  me: User; letters: Letter[]; friendIds: string[]; revealedIds: string[]; chats: Chat[]; posts: Post[];
  notifications: AppNotification[]; passbys: Passby[]; scheduled: ScheduledEvent[]; settings: Settings; lastTick: number;
  focusLetterId: string | null; focusPoint: LatLng | null; permissions: Permissions; backend: 'local' | 'supabase';

  enterAsGuest: (location: Place) => void;                       // 첫 진입: 비회원으로 지구에 들어간다
  signUp: (provider: AuthProvider, profile: ProfileInput, email?: string) => void; // 가입 게이트에서 호출
  setTourDone: () => void;
  updateProfile: (patch: Partial<User>) => void; setLocation: (p: Place) => void; setSettings: (patch: Partial<Settings>) => void;
  setFocusLetter: (id: string | null) => void; setFocusPoint: (p: LatLng | null) => void; setPermissions: (patch: Partial<Permissions>) => void; setBackend: (b: 'local' | 'supabase') => void;

  sendLetter: (input: ComposeInput) => Letter | { error: string };
  catchLetter: (letterId: string) => Letter | undefined;
  peekLetter: (letterId: string) => ActionResult;
  pullLetter: (letterId: string) => ActionResult;
  redirectLetter: (letterId: string, action: 'sunk' | 'space') => ActionResult;
  rerouteLetter: (letterId: string, waypoints: LatLng[]) => ActionResult;
  snailLetter: (letterId: string) => ActionResult;
  rescueLetter: (letterId: string) => ActionResult;
  boostReply: (letterId: string, tier: BoostTier) => ActionResult;   // 오는 답장을 코인으로 가속
  dismissPassby: (id: string) => void;
  approveReply: (letterId: string) => void;   // 도착한 답장 수락 → 친구 + 채팅
  declineLetter: (letterId: string) => void;
  sendMessage: (otherId: string, text: string) => boolean; markChatRead: (otherId: string) => void; markNotificationsRead: () => void;
  likePost: (postId: string) => void; commentPost: (postId: string, text: string) => void; publishPost: (letterId: string, shareToStory: boolean) => void; setPostStory: (postId: string, on: boolean) => void;
  buyItem: (itemId: ItemId) => boolean; applyPack: (packId: PackId) => void; setPlan: (plan: PlanId, expiresAt?: number) => void;
  tick: (now: number) => void; devFastForward: (ms: number) => void; devSpawnPassby: () => void; devSpawnReply: () => void; resetAll: () => void;
};

export const getUser = (state: Pick<State, 'me'>, id: string): User | undefined => (id === ME_ID ? state.me : BOT_BY_ID[id]);
export function matchesTarget(u: User, t: TargetFilter): boolean {
  if (t.field && u.field !== t.field) return false;
  if (t.gender && u.gender !== t.gender) return false;
  if (t.job && u.job !== t.job) return false;
  if (t.hobby && !u.hobbies.includes(t.hobby)) return false;
  return true;
}
const notif = (type: AppNotification['type'], title: string, body: string, route?: string): AppNotification => ({ id: uid(), type, title, body, at: Date.now(), read: false, route });
const fill = (s: string, bot: User) => s.replace('{city}', bot.location.city).replace('{weather}', pick(WEATHERS));
const botVehicles: VehicleId[] = ['walk', 'jog', 'run', 'kick', 'bike', 'pigeon', 'seagull', 'goose', 'crane', 'hawk', 'eagle', 'albatross', 'horse', 'camel', 'dolphin', 'cheetah', 'scooter', 'kei', 'bus', 'sedan', 'truck', 'sports', 'train', 'ktx', 'maglev', 'sail', 'speedboat', 'cruise', 'submarine', 'hover', 'balloon', 'paraglider', 'heli', 'prop', 'airliner', 'fighter', 'concorde', 'rocket', 'ufo', 'satellite', 'carpet', 'dragon'];
const botVehicleFor = (): VehicleId => pick(botVehicles);
/** 봇의 답장 배달원: 봇의 친구 수(=해금 수준)에 따라 느릴 수도 있다 — 그래서 받는 쪽이 가속을 산다 */
const replyVehicleFor = (bot: User): VehicleId => bestVehicle(Math.floor((bot.stats.received + bot.stats.caught) / 4), { ufo: 0, orbit: 0 }, 'free');
const sunkMs = (v: VehicleId, timeScale: number) => { const base = v === 'camel' || v === 'sail' ? OCEAN_SINK_MS / 3 : OCEAN_SINK_MS; return Math.max(90_000, Math.min(base, base / (timeScale / 60))); };

function baseLetter(partial: Partial<Letter> & Pick<Letter, 'senderId' | 'text' | 'origin' | 'destination' | 'vehicle' | 'departedAt' | 'arrivesAt' | 'distanceKm' | 'stamp'>): Letter {
  return { id: uid(), kind: 'letter', randomDestination: false, waypoints: [], shield: false, target: {}, isPublic: false, status: 'flying', redirects: 0, pulls: 0, peekedBy: [], trail: [], events: [{ type: 'departed', at: partial.departedAt, place: partial.origin.city }], ...partial };
}

function makeBotLetter(bot: User, aimAt: LatLng | null, timeScale: number, startProgress = 0): Letter {
  const vehicle = botVehicleFor();
  let destPt: LatLng;
  if (aimAt) {
    const brg = bearingDeg(bot.location, aimAt);
    const jitter = destinationPoint(aimAt, Math.random() * 360, rand(0, 40));
    destPt = aimRouteAt(bot.location, destinationPoint(jitter, brg, rand(500, 2500)), [], vehicle, aimAt);
  } else destPt = randomLandPoint();
  const destination = describePlace(destPt);
  const plan = planFlight(bot.location, destPt, [], vehicle, timeScale);
  const now = Date.now();
  const departedAt = now - plan.durationMs * startProgress;
  const v = VEHICLE_MAP[vehicle];
  return baseLetter({ senderId: bot.id, text: pick(BOT_LETTERS), origin: bot.location, destination, randomDestination: !aimAt, vehicle, shield: v.builtInShield || Math.random() < 0.2, isPublic: Math.random() < 0.3, departedAt, arrivesAt: departedAt + plan.durationMs, distanceKm: plan.distanceKm, stamp: bot.location.city, trail: startProgress > 0 ? seedTrail(bot.location, destPt, [], vehicle, startProgress) : [] });
}
function makeBotPost(bot: User, meLoc: LatLng, at = Date.now()): Post {
  const comments = Array.from({ length: Math.floor(rand(0, 3)) }).map((_, i) => ({ id: uid(), authorId: pick(BOTS).id, text: pick(BOT_COMMENTS), at: at + (i + 1) * 60_000 }));
  return { id: uid(), authorId: bot.id, text: pick(BOT_POSTS), city: bot.location.city, country: bot.location.country, stamp: bot.location.city, vehicle: botVehicleFor(), at, likes: Math.floor(rand(0, 120)), likedByMe: false, distanceKm: Math.round(distanceKm(meLoc, bot.location)), comments, shareToStory: Math.random() < 0.45 };
}
function friendMilestone(me: User, friendCount: number): { me: User; granted: number } {
  const target = Math.floor(friendCount / SHIELD_PER_FRIENDS);
  const granted = Math.max(0, target - me.shieldMilestone);
  return granted ? { me: { ...me, shieldMilestone: target, inventory: { ...me.inventory, shield: me.inventory.shield + granted } }, granted } : { me, granted: 0 };
}
function resetQuota(me: User): User {
  const q = me.quota;
  const d = q.date === today() ? q : { ...q, date: today(), peeks: 0, pulls: 0, earned: 0 };
  const m = d.month === thisMonth() ? d : { ...d, month: thisMonth(), direct: 0 };
  return m === q ? me : { ...me, quota: m };
}
/** 플레이 보상 코인 — 하루 상한 (인플레 방지) */
function earn(me: User, amount: number): User {
  const room = Math.max(0, DAILY_FREE_COIN_CAP - me.quota.earned);
  const give = Math.min(room, amount);
  return give ? { ...me, coins: me.coins + give, quota: { ...me.quota, earned: me.quota.earned + give } } : me;
}
function addFriend(s: { me: User; friendIds: string[]; chats: Chat[] }, other: string, now: number, hello?: string): { me: User; friendIds: string[]; chats: Chat[]; granted: number } {
  const friendIds = s.friendIds.includes(other) ? s.friendIds : [...s.friendIds, other];
  const { me, granted } = friendMilestone(earn(s.me, COIN_REWARDS.friend), friendIds.length);
  const msgs = hello ? [{ id: uid(), senderId: other, text: hello, at: now + 1 }] : [];
  const chats = s.chats.some((c) => c.otherId === other) ? s.chats.map((c) => (c.otherId === other ? { ...c, messages: [...c.messages, ...msgs] } : c)) : [{ id: other, otherId: other, messages: msgs, lastReadAt: 0, since: now }, ...s.chats];
  return { me, friendIds, chats, granted };
}
/** 통과 판정을 할 수 있는 상태의 편지인지 */
const inSky = (l: Letter) => l.status === 'flying';
const grant = (inv: Inventory, g: Partial<Record<keyof Inventory, number>>): Inventory => ({ shield: inv.shield + (g.shield ?? 0), ufo: inv.ufo + (g.ufo ?? 0), orbit: inv.orbit + (g.orbit ?? 0), peek: inv.peek + (g.peek ?? 0), pull: inv.pull + (g.pull ?? 0), direct: inv.direct + (g.direct ?? 0), carpet: inv.carpet + (g.carpet ?? 0) });

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false, signedIn: false, tourDone: false, deviceId: uid(),
      me: DEFAULT_ME, letters: [], friendIds: [], revealedIds: [], chats: [], posts: [], notifications: [], passbys: [], scheduled: [],
      settings: DEFAULT_SETTINGS, lastTick: Date.now(), focusLetterId: null, focusPoint: null, permissions: { location: 'undetermined', backgroundLocation: 'undetermined', notifications: 'undetermined' }, backend: 'local',

      enterAsGuest: (location) => {
        const me: User = resetQuota({ ...get().me, location, avatar: pick(AVATARS), lastActiveAt: Date.now(), createdAt: Date.now(), auth: { provider: 'guest' } });
        const ts = get().settings.timeScale;
        const letters: Letter[] = [];
        const shuffled = [...BOTS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 12; i++) {
          const bot = shuffled[i];
          const aim = i < 3;
          let letter = makeBotLetter(bot, aim ? me.location : null, ts, aim ? 0 : rand(0.05, 0.7));
          if (aim) {
            const pAtUser = Math.min(0.98, closestProgress(letter, me.location));
            const dur = letter.arrivesAt - letter.departedAt;
            const departedAt = Date.now() + rand(45_000, 120_000) + i * 50_000 - pAtUser * dur;
            letter = { ...letter, departedAt, arrivesAt: departedAt + dur, trail: seedTrail(bot.location, letter.destination, [], letter.vehicle, Math.max(0, (Date.now() - departedAt) / dur)) };
          }
          letters.push(letter);
        }
        const posts = shuffled.slice(12, 40).map((b, i) => makeBotPost(b, me.location, Date.now() - i * rand(600_000, 7_200_000))).sort((a, b) => b.at - a.at);
        set({ onboarded: true, me, letters, posts, scheduled: [{ id: uid(), at: Date.now() + 30_000, type: 'bot_send', payload: {} }, { id: uid(), at: Date.now() + 90_000, type: 'bot_post', payload: {} }],
          notifications: [notif('system', '환영해요 🌍', '머리 위로 편지가 지나가면 잡아보세요. 첫 편지는 걸어서 갑니다.')] });
        track('guest_enter', { city: location.city });
      },
      signUp: (provider, profile, email) => {
        const s = get();
        const auth: Auth = { provider, email, signedUpAt: Date.now() };
        set({ signedIn: true, me: { ...s.me, ...profile, auth }, notifications: [notif('system', `${profile.nickname} 님, 가입을 환영해요`, '이제 편지를 보내고 답장을 받을 수 있어요'), ...s.notifications] });
        track('sign_up', { provider });
      },
      setTourDone: () => { set({ tourDone: true }); track('tour_done'); },
      updateProfile: (patch) => set((s) => ({ me: { ...s.me, ...patch } })),
      setLocation: (p) => set((s) => ({ me: { ...s.me, location: p } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setFocusLetter: (id) => set({ focusLetterId: id, focusPoint: null }),
      setFocusPoint: (p) => set({ focusPoint: p, focusLetterId: null }),
      setPermissions: (patch) => set((s) => ({ permissions: { ...s.permissions, ...patch } })),
      setBackend: (b) => set({ backend: b }),

      sendLetter: (input) => {
        const s = get();
        if (!s.signedIn) return { error: '편지를 보내려면 가입이 필요해요' };
        let me = resetQuota(s.me);
        const plan = PLAN_MAP[me.plan];
        const kind: LetterKind = input.kind ?? (input.replyToId ? 'reply' : 'letter');
        if (kind === 'letter' && !input.direct) {
          const sentToday = s.letters.filter((l) => l.senderId === ME_ID && l.kind === 'letter' && new Date(l.departedAt).toDateString() === today()).length;
          if (sentToday >= plan.dailyLetters) return { error: `오늘 편지 ${plan.dailyLetters}통을 다 썼어요. 플러스로 업그레이드하면 더 보낼 수 있어요.` };
        }
        const v = VEHICLE_MAP[input.vehicle];
        const inv: Inventory = { ...me.inventory };
        let coins = me.coins;
        // 대여: 잠긴 배달원을 코인으로 1회
        const unlocked = vehicleUnlocked(v, s.friendIds.length, inv, me.plan);
        let rented = false;
        if (!unlocked) {
          if (!input.rent || v.premiumItem === 'event') return { error: '아직 해금되지 않은 배달원이에요' };
          const price = discounted(rentalCoins(v.speedKmh), me.plan);
          if (coins < price) return { error: `대여에 ${price} SC가 필요해요` };
          coins -= price; rented = true;
        }
        // 직행 편지: 월 한도(프로) → 보유권 → 코인
        if (input.direct) {
          if (!input.recipientId) return { error: '받는 사람이 필요해요' };
          if (me.quota.direct < plan.monthlyDirect) me = { ...me, quota: { ...me.quota, direct: me.quota.direct + 1 } };
          else if (inv.direct > 0) inv.direct -= 1;
          else if (coins >= ITEM_MAP.direct1.coins) coins -= ITEM_MAP.direct1.coins;
          else return { error: `직행 편지에 ${ITEM_MAP.direct1.coins} SC가 필요해요` };
        }
        const ts = s.settings.timeScale;
        const recipient = input.recipientId ? BOT_BY_ID[input.recipientId] : undefined;
        const destPt = input.direct && recipient ? recipient.location : input.destination ?? randomLandPoint();
        const destination = describePlace(destPt);
        const waypoints = input.direct ? [] : input.waypoints ?? [];
        const fl = planFlight(me.location, destPt, waypoints, input.vehicle, ts);
        const now = Date.now();
        const shield = v.builtInShield || input.direct || (input.useShield && inv.shield > 0);
        if (!v.builtInShield && !input.direct && shield) inv.shield -= 1;
        if (!rented) {
          if (v.premiumItem === 'ufo') inv.ufo = Math.max(0, inv.ufo - 1);
          if (v.premiumItem === 'orbit') inv.orbit = Math.max(0, inv.orbit - 1);
          if (v.premiumItem === 'carpet' && me.plan !== 'pro') inv.carpet = Math.max(0, inv.carpet - 1);
        }
        const letter = baseLetter({ kind, senderId: ME_ID, recipientId: input.recipientId, replyToId: input.replyToId, friendRequest: input.friendRequest, direct: input.direct || undefined, rented: rented || undefined, text: input.text, imageUri: input.imageUri, origin: me.location, destination, randomDestination: !input.destination && !input.direct, waypoints, vehicle: input.vehicle, shield, target: input.direct ? {} : input.target, isPublic: input.isPublic, departedAt: now, arrivesAt: now + fl.durationMs, distanceKm: fl.distanceKm, stamp: me.location.city,
          events: [{ type: 'departed', at: now, place: me.location.city }, ...(rented ? [{ type: 'rented' as const, at: now, by: ME_ID }] : [])] });
        const sched: ScheduledEvent[] = [];
        if (kind === 'letter' && !input.direct) {
          const candidates = BOTS.filter((b) => matchesTarget(b, input.target));
          const nearDest = candidates.map((b) => ({ b, d: distanceKm(b.location, destPt) })).sort((x, y) => x.d - y.d);
          const catcher = nearDest[0] && (nearDest[0].d < 2500 || Math.random() < 0.35) ? nearDest[0].b : null;
          if (catcher && Math.random() < 0.9) sched.push({ id: uid(), at: letter.arrivesAt + rand(15_000, 60_000), type: 'bot_catch', payload: { letterId: letter.id, botId: catcher.id } });
          if (!v.immune && Math.random() < 0.15) sched.push({ id: uid(), at: now + fl.durationMs * rand(0.3, 0.7), type: 'bot_mischief', payload: { letterId: letter.id, botId: pick(BOTS).id } });
        }
        let posts = s.posts;
        if (input.isPublic && kind === 'letter' && !input.direct) {
          posts = [{ id: uid(), letterId: letter.id, authorId: ME_ID, text: input.text, imageUri: input.imageUri, city: me.location.city, country: me.location.country, stamp: me.location.city, vehicle: input.vehicle, at: now, likes: 0, likedByMe: false, distanceKm: Math.round(fl.distanceKm), comments: [], shareToStory: !!input.shareToStory }, ...s.posts];
          sched.push({ id: uid(), at: now + rand(20_000, 90_000), type: 'bot_like', payload: { postId: posts[0].id } });
          if (Math.random() < 0.7) sched.push({ id: uid(), at: now + rand(40_000, 120_000), type: 'bot_comment', payload: { postId: posts[0].id } });
        }
        me = earn({ ...me, inventory: inv, coins, stats: { ...me.stats, sent: me.stats.sent + 1, distanceKm: me.stats.distanceKm + Math.round(fl.distanceKm) } }, COIN_REWARDS.send);
        set({ letters: [letter, ...s.letters], scheduled: [...s.scheduled, ...sched], posts, me, focusLetterId: letter.id, revealedIds: input.direct && input.recipientId && !s.revealedIds.includes(input.recipientId) ? [...s.revealedIds, input.recipientId] : s.revealedIds });
        track('letter_send', { kind, vehicle: input.vehicle, direct: !!input.direct, rented, km: Math.round(fl.distanceKm), shield });
        return letter;
      },

      catchLetter: (letterId) => {
        const s = get();
        const letter = s.letters.find((l) => l.id === letterId);
        if (!letter || letter.status === 'caught') return letter;
        const now = Date.now();
        const place = s.me.location.city;
        const updated: Letter = { ...letter, status: 'caught', caughtBy: ME_ID, caughtAt: now, catchPlace: place, events: [...letter.events, { type: 'caught', at: now, by: ME_ID, place }] };
        const stamps = s.me.stamps.includes(letter.stamp) ? s.me.stamps : [...s.me.stamps, letter.stamp];
        const me = earn({ ...s.me, stamps, stats: { ...s.me.stats, caught: s.me.stats.caught + 1, received: s.me.stats.received + 1 } }, COIN_REWARDS.catch);
        set({
          letters: s.letters.map((l) => (l.id === letterId ? updated : l)),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'caught' } : p)),
          revealedIds: s.revealedIds.includes(letter.senderId) ? s.revealedIds : [...s.revealedIds, letter.senderId],
          me,
          notifications: [notif('reward', `+${COIN_REWARDS.catch} SC`, `${letter.stamp}에서 온 편지를 잡았어요. 보낸 사람의 프로필을 보고 답장해보세요`, `/letter/${letter.id}`), ...s.notifications],
        });
        track('letter_catch', { vehicle: letter.vehicle, from: letter.origin.country });
        return updated;
      },

      peekLetter: (letterId) => {
        const s = get();
        const me = resetQuota(s.me);
        const l = s.letters.find((x) => x.id === letterId);
        const pb = s.passbys.find((p) => p.letterId === letterId && !p.resolved);
        if (!l || !pb) return 'done';
        if (pb.peeked) return 'done';
        const v = VEHICLE_MAP[l.vehicle];
        if (v.id === 'submarine' || v.id === 'carpet') return 'immune';
        const plan = PLAN_MAP[me.plan];
        let inv = me.inventory;
        let quota = me.quota;
        if (quota.peeks < plan.dailyPeeks) quota = { ...quota, peeks: quota.peeks + 1 };
        else if (inv.peek > 0) inv = { ...inv, peek: inv.peek - 1 };
        else return 'quota';
        set({ me: { ...me, inventory: inv, quota }, passbys: s.passbys.map((p) => (p.id === pb.id ? { ...p, peeked: true } : p)), letters: s.letters.map((x) => (x.id === letterId ? { ...x, peekedBy: [...x.peekedBy, ME_ID], events: [...x.events, { type: 'peeked', at: Date.now(), by: ME_ID, place: me.location.city }] } : x)) });
        track('letter_peek', { vehicle: l.vehicle });
        return 'done';
      },

      pullLetter: (letterId) => {
        const s = get();
        const me = resetQuota(s.me);
        const l = s.letters.find((x) => x.id === letterId);
        const pb = s.passbys.find((p) => p.letterId === letterId && !p.resolved);
        if (!l || !pb) return 'done';
        if (l.status !== 'flying') return 'gone';
        const v = VEHICLE_MAP[l.vehicle];
        const now = Date.now();
        if (v.immune) { set({ passbys: s.passbys.map((p) => (p.id === pb.id ? { ...p, resolved: 'defended' } : p)) }); return 'immune'; }
        if (l.pulls > 0) return 'limit';
        const plan = PLAN_MAP[me.plan];
        let inv = me.inventory; let quota = me.quota;
        if (quota.pulls < plan.dailyPulls) quota = { ...quota, pulls: quota.pulls + 1 };
        else if (inv.pull > 0) inv = { ...inv, pull: inv.pull - 1 };
        else return 'quota';
        if (l.shield) {
          set({ me: { ...me, inventory: inv, quota }, letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: me.location.city }] } : x)), passbys: s.passbys.map((p) => (p.id === pb.id ? { ...p, resolved: 'defended' } : p)) });
          return 'defended';
        }
        const target = fuzzToGrid(me.location, 10);
        const patch = pullTo(l, now, target, s.settings.timeScale);
        set({
          me: { ...me, inventory: inv, quota },
          letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...patch, destination: { ...target, city: me.location.city, country: me.location.country }, pulls: 1, pulledBy: ME_ID, target: {}, events: [...x.events, { type: 'pulled', at: now, by: ME_ID, place: me.location.city }] } : x)),
          passbys: s.passbys.map((p) => (p.id === pb.id ? { ...p, resolved: 'pulled' } : p)),
          focusLetterId: letterId,
          notifications: [notif('system', '🧲 편지를 끌어왔어요', '내 위치에 도착하면 알림이 와요. 그때 집어가세요', `/letter/${letterId}`), ...s.notifications],
        });
        track('letter_pull', { vehicle: l.vehicle });
        return 'done';
      },

      redirectLetter: (letterId, action) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l) return 'done';
        if (l.status !== 'flying') return 'gone';
        const now = Date.now();
        const v = VEHICLE_MAP[l.vehicle];
        const resolvePb = (r: Passby['resolved']) => s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: r } : p));
        if (v.immune || (action === 'sunk' && v.immuneOcean)) { set({ passbys: resolvePb('defended') }); return 'immune'; }
        if (l.shield) { set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: resolvePb('defended') }); return 'defended'; }
        const patch: Partial<Letter> = action === 'sunk' ? { status: 'sunk', sunkAt: now, sunkUntil: now + sunkMs(l.vehicle, s.settings.timeScale) } : { status: action };
        set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...patch, events: [...x.events, { type: action, at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: resolvePb(action), me: earn(s.me, COIN_REWARDS.mischief) });
        track('letter_mischief', { action, vehicle: l.vehicle });
        return 'done';
      },

      rerouteLetter: (letterId, waypoints) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l) return 'done';
        if (l.status !== 'flying') return 'gone';
        if (waypoints.length < 1 || waypoints.length > PLAN_MAP[s.me.plan].maxWaypoints) return 'limit';
        const now = Date.now();
        const resolvePb = (r: Passby['resolved']) => s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: r } : p));
        if (VEHICLE_MAP[l.vehicle].immune) { set({ passbys: resolvePb('defended') }); return 'immune'; }
        if (l.shield) { set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: resolvePb('defended') }); return 'defended'; }
        const patch = rerouteThrough(l, now, waypoints, s.settings.timeScale);
        set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...patch, redirects: x.redirects + 1, events: [...x.events, { type: 'rerouted', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: resolvePb('rerouted'), me: earn(s.me, COIN_REWARDS.mischief), focusLetterId: letterId });
        track('letter_mischief', { action: 'rerouted', waypoints: waypoints.length });
        return 'done';
      },

      snailLetter: (letterId) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l) return 'done';
        if (l.status !== 'flying') return 'gone';
        const now = Date.now();
        const v = VEHICLE_MAP[l.vehicle];
        const resolvePb = (r: Passby['resolved']) => s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: r } : p));
        if (v.immune || v.immuneSnail) { set({ passbys: resolvePb('defended') }); return 'immune'; }
        if (l.shield) { set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: resolvePb('defended') }); return 'defended'; }
        set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...applySnail(x, now), events: [...x.events, { type: 'snail', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: resolvePb('snail'), me: earn(s.me, COIN_REWARDS.mischief) });
        track('letter_mischief', { action: 'snail' });
        return 'done';
      },

      rescueLetter: (letterId) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || l.status !== 'sunk' || l.senderId !== ME_ID) return 'done';
        if (s.me.coins < OCEAN_RESCUE_COINS) return 'nofunds';
        const now = Date.now();
        set({ me: { ...s.me, coins: s.me.coins - OCEAN_RESCUE_COINS }, letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...resurface(x, now), status: 'flying', sunkAt: undefined, sunkUntil: undefined, events: [...x.events, { type: 'rescued', at: now, by: ME_ID }] } : x)), focusLetterId: letterId });
        track('coin_spend', { on: 'rescue', coins: OCEAN_RESCUE_COINS });
        return 'done';
      },

      boostReply: (letterId, tier) => {
        // 내게 오는 답장을 코인으로 가속 — 상대 배달원이 느릴 때 유료 유저의 선택지
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || l.recipientId !== ME_ID || l.status !== 'flying') return 'gone';
        if (l.boost === 'instant' || (l.boost === 'fast' && tier === 'fast')) return 'limit';
        const price = discounted(REPLY_BOOST[tier].coins, s.me.plan);
        if (s.me.coins < price) return 'nofunds';
        const now = Date.now();
        const remaining = tier === 'instant' ? REPLY_BOOST.instant.seconds * 1000 : Math.max(5_000, (l.arrivesAt - now) / REPLY_BOOST.fast.factor);
        set({ me: { ...s.me, coins: s.me.coins - price }, letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...speedUp(x, now, remaining), boost: tier, events: [...x.events, { type: 'boosted', at: now, by: ME_ID }] } : x)), focusLetterId: letterId,
          notifications: [notif('boost', tier === 'instant' ? '⚡ 답장이 1분 안에 도착해요' : '⚡ 답장이 4배 빨라졌어요', `${price} SC 사용`, `/letter/${letterId}`), ...s.notifications] });
        track('coin_spend', { on: `boost_${tier}`, coins: price });
        return 'done';
      },

      dismissPassby: (id) => set((s) => ({ passbys: s.passbys.map((p) => (p.id === id && !p.resolved ? { ...p, resolved: 'missed' } : p)) })),

      approveReply: (letterId) => {
        // 도착한 답장(kind reply)을 수락 → 친구 + 채팅. 왕복(내 편지 → 상대 답장)이 끝난 뒤에만 가능.
        const s = get();
        const r = s.letters.find((x) => x.id === letterId);
        if (!r || r.kind !== 'reply' || r.recipientId !== ME_ID || r.status !== 'delivered') return;
        const other = r.senderId;
        const now = Date.now();
        const bot = BOT_BY_ID[other];
        const { me, friendIds, chats, granted } = addFriend(s, other, now, bot ? fill(pick(BOT_GREETINGS), bot) : undefined);
        const noti = [notif('approved', `🤝 ${bot?.nickname ?? '???'} 님과 친구가 됐어요`, `왕복 완료 · 지연 없는 실시간 채팅 · +${COIN_REWARDS.friend} SC`, `/chat/${other}`)];
        if (granted) noti.push(notif('reward', `🛡️ 방어권 +${granted}`, `친구 ${friendIds.length}명 달성 보너스`));
        set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, status: 'approved', events: [...x.events, { type: 'approved', at: now, by: ME_ID }] } : x)), friendIds, chats, me, notifications: [...noti, ...s.notifications] });
        track('reply_approve', { friends: friendIds.length });
      },
      declineLetter: (letterId) => { set((s) => ({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, status: 'declined', events: [...x.events, { type: 'declined', at: Date.now(), by: ME_ID }] } : x)) })); track('reply_decline'); },

      sendMessage: (otherId, text) => {
        const s = get();
        if (!s.friendIds.includes(otherId)) return false;
        const chat = s.chats.find((c) => c.otherId === otherId) ?? { id: otherId, otherId, messages: [], lastReadAt: Date.now(), since: Date.now() };
        const updated: Chat = { ...chat, messages: [...chat.messages, { id: uid(), senderId: ME_ID, text, at: Date.now() }], lastReadAt: Date.now() };
        const chats = s.chats.some((c) => c.otherId === otherId) ? s.chats.map((c) => (c.otherId === otherId ? updated : c)) : [updated, ...s.chats];
        const sched = BOT_BY_ID[otherId] ? [...s.scheduled, { id: uid(), at: Date.now() + rand(2_500, 9_000), type: 'bot_chat' as const, payload: { botId: otherId } }] : s.scheduled;
        set({ chats, scheduled: sched });
        track('chat_send', { len: text.length });
        return true;
      },
      markChatRead: (otherId) => set((s) => ({ chats: s.chats.map((c) => (c.otherId === otherId ? { ...c, lastReadAt: Date.now() } : c)) })),
      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      likePost: (postId) => { set((s) => ({ posts: s.posts.map((p) => (p.id === postId ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) } : p)) })); track('post_like'); },
      commentPost: (postId, text) => {
        const s = get();
        const post = s.posts.find((p) => p.id === postId);
        if (!post || !text.trim()) return;
        const sched = post.authorId !== ME_ID && Math.random() < 0.6 ? [...s.scheduled, { id: uid(), at: Date.now() + rand(8_000, 40_000), type: 'bot_comment' as const, payload: { postId, botId: post.authorId } }] : s.scheduled;
        set({ posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, { id: uid(), authorId: ME_ID, text: text.trim(), at: Date.now() }] } : p)), scheduled: sched, me: earn(s.me, COIN_REWARDS.comment) });
        track('post_comment');
      },
      publishPost: (letterId, shareToStory) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || s.posts.some((p) => p.letterId === letterId)) return;
        const post: Post = { id: uid(), letterId, authorId: l.senderId, text: l.text, imageUri: l.imageUri, city: l.origin.city, country: l.origin.country, stamp: l.stamp, vehicle: l.vehicle, at: Date.now(), likes: 0, likedByMe: false, distanceKm: Math.round(l.distanceKm), comments: [], shareToStory };
        set({ posts: [post, ...s.posts], letters: s.letters.map((x) => (x.id === letterId ? { ...x, isPublic: true } : x)), scheduled: [...s.scheduled, { id: uid(), at: Date.now() + rand(15_000, 60_000), type: 'bot_like', payload: { postId: post.id } }] });
        track('post_publish', { story: shareToStory });
      },
      setPostStory: (postId, on) => set((s) => ({ posts: s.posts.map((p) => (p.id === postId ? { ...p, shareToStory: on } : p)) })),

      buyItem: (itemId) => {
        const s = get();
        const it = ITEM_MAP[itemId];
        if (!it || s.me.coins < it.coins) return false;
        set({ me: { ...s.me, coins: s.me.coins - it.coins, inventory: grant(s.me.inventory, it.grants) } });
        track('coin_spend', { on: itemId, coins: it.coins });
        return true;
      },
      applyPack: (packId) => {
        const s = get();
        const p = PACK_MAP[packId];
        if (!p) return;
        set({ me: { ...s.me, coins: s.me.coins + p.coins }, notifications: [notif('reward', `${p.coins.toLocaleString('ko-KR')} SC 충전 완료`, p.bonusPct ? `보너스 ${p.bonusPct}% 포함` : '썸원코인이 채워졌어요'), ...s.notifications] });
        track('purchase', { pack: packId, krw: p.priceKrw, coins: p.coins });
      },
      setPlan: (plan, expiresAt) => {
        const s = get();
        const P = PLAN_MAP[plan];
        const upgrade = plan !== 'free' && plan !== s.me.plan;
        set({ me: { ...s.me, plan, planExpiresAt: expiresAt, coins: s.me.coins + (upgrade ? P.monthlyCoins : 0), inventory: upgrade ? grant(s.me.inventory, { shield: P.monthlyShields, ufo: P.monthlyUfo, orbit: P.monthlyOrbit }) : s.me.inventory },
          notifications: upgrade ? [notif('reward', `${P.badge ?? ''} ${P.name} 시작!`, `${P.monthlyCoins} SC · 방어권 ${P.monthlyShields}${P.monthlyUfo ? ` · UFO ${P.monthlyUfo}` : ''}${P.monthlyOrbit ? ` · 위성 ${P.monthlyOrbit}` : ''} · 엿보기 ${P.dailyPeeks}/일 · 끌어오기 ${P.dailyPulls}/일 · 경유지 ${P.maxWaypoints}`), ...s.notifications] : s.notifications });
        if (upgrade) track('purchase', { plan, krw: P.monthlyKrw });
      },

      tick: (now) => {
        const s = get();
        if (!s.onboarded) return;
        const prev = s.lastTick;
        const local = s.backend === 'local';
        let { letters, passbys, notifications, chats, friendIds, revealedIds, scheduled, posts } = s;
        let me = resetQuota(s.me);
        let changed = me !== s.me;
        const pushes: { title: string; body: string; route?: string }[] = [];
        const nf = (n: AppNotification) => { notifications = [n, ...notifications]; };

        // 0) trail 기록 · 침수 복귀
        letters = letters.map((l) => {
          if (l.status === 'sunk' && l.sunkUntil && now >= l.sunkUntil) {
            changed = true;
            if (l.senderId === ME_ID) nf(notif('sunk', '🌊 편지가 다시 떠올랐어요', '이어서 목적지로 갑니다', `/letter/${l.id}`));
            return { ...l, ...resurface(l, now), status: 'flying', sunkAt: undefined, sunkUntil: undefined, events: [...l.events, { type: 'resurfaced', at: now }] };
          }
          if (l.status === 'flying') { const t = appendTrail(l, now); if (t) { changed = true; return { ...l, trail: t }; } }
          return l;
        });

        // 1) 도착
        letters = letters.map((l) => {
          if (l.status === 'flying' && now >= l.arrivesAt) {
            changed = true;
            if (l.recipientId) {
              if (l.recipientId === ME_ID) {
                if (!revealedIds.includes(l.senderId)) revealedIds = [...revealedIds, l.senderId];
                me = earn({ ...me, stats: { ...me.stats, received: me.stats.received + 1 } }, COIN_REWARDS.received);
                const isReply = l.kind === 'reply';
                nf(notif(isReply ? 'reply' : 'direct', isReply ? '📬 답장이 도착했어요' : '📬 직행 편지가 도착했어요', isReply ? `${l.origin.city}에서 온 답장. 수락하면 친구가 되고 실시간 채팅이 열려요` : `${l.origin.city}에서 누군가 나에게 직접 보냈어요`, `/letter/${l.id}`));
                pushes.push({ title: isReply ? '📬 답장이 도착했어요' : '📬 직행 편지가 도착했어요', body: isReply ? '수락하면 친구' : '읽고 답장해보세요', route: `/letter/${l.id}` });
              } else if (local && BOT_BY_ID[l.recipientId]) {
                // 봇에게 도착: 내 답장이면 봇이 수락(90%) → 친구 / 내 직행 편지면 봇이 답장(80%)
                scheduled = [...scheduled, { id: uid(), at: now + rand(10_000, 40_000), type: l.kind === 'reply' ? 'bot_approve' : 'bot_reply', payload: l.kind === 'reply' ? { letterId: l.id } : { botId: l.recipientId, letterId: l.id, direct: true } }];
                nf(notif('landed', `📬 ${l.kind === 'reply' ? '답장' : '직행 편지'}이 ${l.destination.city}에 도착`, l.kind === 'reply' ? '상대가 수락하면 친구가 돼요' : '상대가 답장하면 우편함에 와요', `/letter/${l.id}`));
              }
              return { ...l, status: 'delivered', landedAt: now, events: [...l.events, { type: 'delivered', at: now, place: l.destination.city }] };
            }
            const nearMe = distanceKm(l.destination, me.location) <= LANDED_RADIUS_KM;
            if (l.senderId === ME_ID) nf(notif('landed', `📍 ${l.destination.city}에 착륙`, '누군가 집어갈 때까지 기다려요', `/letter/${l.id}`));
            else if (nearMe && !passbys.some((p) => p.letterId === l.id && !p.resolved)) {
              const canCatch = l.pulledBy === ME_ID || matchesTarget(me, l.target);
              passbys = [{ id: uid(), letterId: l.id, at: now, expiresAt: now + LANDED_WINDOW_MS, canCatch }, ...passbys];
              nf(notif('passby', l.pulledBy === ME_ID ? '🧲 끌어온 편지가 도착했어요' : '📍 근처에 편지가 착륙했어요', `${l.origin.city}에서 온 ${VEHICLE_MAP[l.vehicle].name}`, `/catch/${l.id}`));
              pushes.push({ title: '📍 근처에 편지가 착륙했어요', body: `${l.origin.city}에서 온 편지를 집어가세요`, route: `/catch/${l.id}` });
            }
            return { ...l, status: 'landed', landedAt: now, events: [...l.events, { type: 'landed', at: now, place: l.destination.city }] };
          }
          if (l.status === 'landed' && l.landedAt && now - l.landedAt > LANDED_WINDOW_MS * (l.senderId === ME_ID ? 3 : 1)) {
            if (scheduled.some((e) => e.type === 'bot_catch' && e.payload.letterId === l.id)) return l;
            changed = true;
            return { ...l, status: 'expired', events: [...l.events, { type: 'expired', at: now }] };
          }
          return l;
        });

        // 2) 통과 판정 (직행·수신자 지정 편지는 통과 없음)
        for (const l of letters) {
          if (!inSky(l) || l.senderId === ME_ID || l.recipientId) continue;
          if (passbys.some((p) => p.letterId === l.id)) continue;
          if (minDistanceBetween(l, prev, now, me.location) <= PASSBY_RADIUS_KM) {
            changed = true;
            const canCatch = matchesTarget(me, l.target);
            const v = VEHICLE_MAP[l.vehicle];
            // 빠른 배달원은 지나가자마자 착륙한다 → 창은 착륙 시각까지(최소 15초). 착륙 후엔 잡기만 되고 장난은 'gone'
            passbys = [{ id: uid(), letterId: l.id, at: now, expiresAt: Math.max(now + 15_000, Math.min(now + catchWindowMs(l.vehicle), l.arrivesAt)), canCatch }, ...passbys];
            const title = `${v.name}이(가) 머리 위를 지나가요!`;
            const body = canCatch ? `${l.origin.city}에서 출발한 편지. 잡거나, 엿보거나, 끌어오세요` : '조건이 맞는 사람만 잡을 수 있어요 (엿보기·경로 변경은 가능)';
            nf(notif('passby', title, body, `/catch/${l.id}`));
            pushes.push({ title, body, route: `/catch/${l.id}` });
            letters = letters.map((x) => (x.id === l.id ? { ...x, events: [...x.events, { type: 'passby', at: now, place: me.location.city }] } : x));
          }
        }
        passbys = passbys.map((p) => (!p.resolved && now > p.expiresAt ? ((changed = true), { ...p, resolved: 'missed' as const }) : p));
        if (passbys.length > 40) passbys = passbys.slice(0, 40);

        // 3) 봇 스케줄
        const due = local ? scheduled.filter((e) => e.at <= now) : [];
        if (due.length) {
          changed = true;
          scheduled = scheduled.filter((e) => e.at > now);
          for (const e of due) {
            switch (e.type) {
              case 'bot_send': {
                const active = letters.filter((l) => inSky(l) && l.senderId !== ME_ID).length;
                if (active < 16) letters = [makeBotLetter(pick(BOTS), Math.random() < 0.45 ? me.location : null, s.settings.timeScale), ...letters];
                scheduled.push({ id: uid(), at: now + rand(25_000, 60_000), type: 'bot_send', payload: {} });
                break;
              }
              case 'bot_post': { posts = [makeBotPost(pick(BOTS), me.location), ...posts].slice(0, 90); scheduled.push({ id: uid(), at: now + rand(90_000, 240_000), type: 'bot_post', payload: {} }); break; }
              case 'bot_like': {
                const post = posts.find((p) => p.id === e.payload.postId);
                if (post) {
                  posts = posts.map((p) => (p.id === post.id ? { ...p, likes: p.likes + 1 } : p));
                  me = earn({ ...me, stats: { ...me.stats, likes: me.stats.likes + 1 } }, COIN_REWARDS.like);
                  nf(notif('like', '❤️ 누군가 내 엽서를 좋아해요', post.text.slice(0, 40), `/post/${post.id}`));
                  if (Math.random() < 0.5) scheduled.push({ id: uid(), at: now + rand(30_000, 120_000), type: 'bot_like', payload: { postId: post.id } });
                }
                break;
              }
              case 'bot_comment': {
                const post = posts.find((p) => p.id === e.payload.postId);
                if (post) {
                  const bot = BOT_BY_ID[e.payload.botId] ?? pick(BOTS);
                  posts = posts.map((p) => (p.id === post.id ? { ...p, comments: [...p.comments, { id: uid(), authorId: bot.id, text: pick(BOT_COMMENTS), at: now }] } : p));
                  if (post.authorId === ME_ID) nf(notif('comment', '💬 내 엽서에 댓글이 달렸어요', post.text.slice(0, 40), `/post/${post.id}`));
                }
                break;
              }
              case 'bot_catch': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = BOT_BY_ID[e.payload.botId];
                if (!l || !bot || (l.status !== 'landed' && l.status !== 'flying')) break;
                letters = letters.map((x) => (x.id === l.id ? { ...x, status: 'caught', caughtBy: bot.id, caughtAt: now, catchPlace: bot.location.city, events: [...x.events, { type: 'caught', at: now, by: bot.id, place: bot.location.city }] } : x));
                nf(notif('caught', `🎉 ${bot.location.city}에서 누군가 내 편지를 잡았어요`, '답장이 오면 프로필을 보고 수락해보세요', `/letter/${l.id}`));
                pushes.push({ title: `🎉 ${bot.location.city}에서 누군가 내 편지를 잡았어요`, body: '곧 답장이 날아올지도', route: `/letter/${l.id}` });
                me = earn(me, COIN_REWARDS.caughtByOther);
                if (Math.random() < 0.75 && !friendIds.includes(bot.id)) scheduled.push({ id: uid(), at: now + rand(10_000, 40_000), type: 'bot_reply', payload: { botId: bot.id, letterId: l.id } });
                break;
              }
              case 'bot_reply': {
                // 봇이 답장 — 봇의 배달원은 봇의 해금 수준(느릴 수 있음). 받는 나는 코인으로 가속할 수 있다.
                const bot = BOT_BY_ID[e.payload.botId];
                if (!bot || friendIds.includes(bot.id)) break;
                if (e.payload.direct && Math.random() < 0.2) { nf(notif('system', `😶 ${bot.nickname} 님은 아직 답장이 없어요`, '직행 편지는 도착까지만 보장돼요', `/letter/${e.payload.letterId}`)); break; }
                const vehicle = replyVehicleFor(bot);
                const fl = planFlight(bot.location, me.location, [], vehicle, s.settings.timeScale);
                const reply = baseLetter({ kind: 'reply', senderId: bot.id, recipientId: ME_ID, replyToId: e.payload.letterId, friendRequest: true, text: pick(BOT_REPLIES_LETTER), origin: bot.location, destination: me.location, vehicle, shield: true, departedAt: now, arrivesAt: now + fl.durationMs, distanceKm: fl.distanceKm, stamp: bot.location.city });
                letters = [reply, ...letters];
                if (!revealedIds.includes(bot.id)) revealedIds = [...revealedIds, bot.id];
                nf(notif('reply', `✉️ ${bot.location.city}에서 답장이 출발했어요`, `${VEHICLE_MAP[vehicle].name}로 오는 중 · 느리면 코인으로 가속할 수 있어요`, `/letter/${reply.id}`));
                pushes.push({ title: '✉️ 답장이 출발했어요', body: `${VEHICLE_MAP[vehicle].name}로 오는 중`, route: `/letter/${reply.id}` });
                break;
              }
              case 'bot_approve': {
                // 봇이 내 답장을 수락(90%) → 친구
                const r = letters.find((x) => x.id === e.payload.letterId);
                const bot = r ? BOT_BY_ID[r.recipientId ?? ''] : undefined;
                if (!r || !bot || r.status !== 'delivered') break;
                if (Math.random() < 0.1) { letters = letters.map((x) => (x.id === r.id ? { ...x, status: 'declined', events: [...x.events, { type: 'declined', at: now, by: bot.id }] } : x)); nf(notif('system', '😢 상대가 답장을 수락하지 않았어요', '다른 편지를 날려보세요', `/letter/${r.id}`)); break; }
                const res = addFriend({ me, friendIds, chats }, bot.id, now, fill(pick(BOT_GREETINGS), bot));
                me = res.me; friendIds = res.friendIds; chats = res.chats;
                letters = letters.map((x) => (x.id === r.id ? { ...x, status: 'approved', events: [...x.events, { type: 'approved', at: now, by: bot.id }] } : x));
                nf(notif('approved', `🤝 ${bot.nickname} 님과 친구가 됐어요`, `왕복 완료 · 실시간 채팅 · +${COIN_REWARDS.friend} SC`, `/chat/${bot.id}`));
                if (res.granted) nf(notif('reward', `🛡️ 방어권 +${res.granted}`, `친구 ${friendIds.length}명 달성 보너스`));
                pushes.push({ title: `🤝 ${bot.nickname} 님과 친구가 됐어요`, body: '실시간 채팅이 열렸어요', route: `/chat/${bot.id}` });
                break;
              }
              case 'bot_chat': {
                const bot = BOT_BY_ID[e.payload.botId];
                if (!bot) break;
                const reply = { id: uid(), senderId: bot.id, text: fill(pick(BOT_REPLIES), bot), at: now };
                chats = chats.map((c) => (c.otherId === bot.id ? { ...c, messages: [...c.messages, reply] } : c));
                nf(notif('chat', `💬 ${bot.nickname}`, reply.text, `/chat/${bot.id}`));
                pushes.push({ title: bot.nickname, body: reply.text, route: `/chat/${bot.id}` });
                break;
              }
              case 'bot_mischief': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = BOT_BY_ID[e.payload.botId];
                if (!l || !bot || l.status !== 'flying') break;
                const v = VEHICLE_MAP[l.vehicle];
                if (l.shield) {
                  letters = letters.map((x) => (x.id === l.id ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: bot.id, place: bot.location.city }] } : x));
                  nf(notif('defended', '🛡️ 방어권이 장난을 막았어요', `${bot.location.city}에서 누군가 편지를 건드렸지만 튕겨냈어요`, `/letter/${l.id}`));
                  pushes.push({ title: '🛡️ 방어권이 장난을 막았어요', body: '편지는 무사히 가는 중', route: `/letter/${l.id}` });
                } else {
                  const options = (['rerouted', 'snail', 'sunk', 'space', 'pulled'] as const).filter((a) => !(a === 'sunk' && v.immuneOcean) && !(a === 'snail' && v.immuneSnail));
                  const action = pick(options);
                  if (action === 'rerouted') {
                    const wp = destinationPoint(bot.location, Math.random() * 360, rand(200, 900));
                    letters = letters.map((x) => (x.id === l.id ? { ...x, ...rerouteThrough(x, now, [wp], s.settings.timeScale), redirects: x.redirects + 1, events: [...x.events, { type: 'rerouted', at: now, by: bot.id, place: bot.location.city }] } : x));
                    nf(notif('mischief', '🧭 누군가 내 편지의 경로를 바꿨어요', `${bot.location.city} 근처로 돌아가는 중. 방어권이 있으면 막을 수 있어요`, `/letter/${l.id}`));
                  } else if (action === 'pulled') {
                    const patch = pullTo(l, now, bot.location, s.settings.timeScale);
                    letters = letters.map((x) => (x.id === l.id ? { ...x, ...patch, destination: bot.location, pulls: 1, pulledBy: bot.id, events: [...x.events, { type: 'pulled', at: now, by: bot.id, place: bot.location.city }] } : x));
                    scheduled.push({ id: uid(), at: patch.arrivesAt + rand(5_000, 20_000), type: 'bot_catch', payload: { letterId: l.id, botId: bot.id } });
                    nf(notif('mischief', '🧲 누군가 내 편지를 끌어갔어요', `${bot.location.city}로 가는 중. 방어권이 있으면 막을 수 있어요`, `/letter/${l.id}`));
                  } else if (action === 'snail') {
                    letters = letters.map((x) => (x.id === l.id ? { ...x, ...applySnail(x, now), events: [...x.events, { type: 'snail', at: now, by: bot.id, place: bot.location.city }] } : x));
                    nf(notif('mischief', '🐌 내 편지에 달팽이가 붙었어요', `${SNAIL.durationMs / 60_000}분 동안 느려져요`, `/letter/${l.id}`));
                  } else if (action === 'sunk') {
                    letters = letters.map((x) => (x.id === l.id ? { ...x, status: 'sunk', sunkAt: now, sunkUntil: now + sunkMs(x.vehicle, s.settings.timeScale), events: [...x.events, { type: 'sunk', at: now, by: bot.id, place: bot.location.city }] } : x));
                    nf(notif('sunk', '🌊 내 편지가 침수됐어요', `${Math.round(sunkMs(l.vehicle, s.settings.timeScale) / 60_000)}분 뒤 떠오르거나, 지금 건져낼 수 있어요 (${OCEAN_RESCUE_COINS} SC)`, `/letter/${l.id}`));
                  } else {
                    letters = letters.map((x) => (x.id === l.id ? { ...x, status: 'space', events: [...x.events, { type: 'space', at: now, by: bot.id, place: bot.location.city }] } : x));
                    nf(notif('mischief', '🚀 내 편지가 우주로 날아갔어요', '방어권을 장착하면 막을 수 있어요', '/store'));
                  }
                  pushes.push({ title: '😈 누군가 내 편지에 장난을 쳤어요', body: '방어권으로 막을 수 있어요', route: `/letter/${l.id}` });
                }
                break;
              }
              default: break;
            }
          }
        }
        if (local && !scheduled.some((e) => e.type === 'bot_send')) { scheduled = [...scheduled, { id: uid(), at: now + 30_000, type: 'bot_send', payload: {} }]; changed = true; }
        if (local && !scheduled.some((e) => e.type === 'bot_post')) { scheduled = [...scheduled, { id: uid(), at: now + 120_000, type: 'bot_post', payload: {} }]; changed = true; }
        if (letters.length > 100) {
          const keep = letters.filter((l) => l.senderId === ME_ID || l.recipientId === ME_ID || inSky(l) || l.status === 'sunk' || l.caughtBy === ME_ID || now - (l.landedAt ?? l.arrivesAt) < 3_600_000);
          if (keep.length !== letters.length) { letters = keep; changed = true; }
        }
        if (notifications.length > 80) notifications = notifications.slice(0, 80);
        if (s.settings.notifications) for (const p of pushes) pushLocal(p.title, p.body, { route: p.route });
        if (changed) set({ letters, passbys, notifications, chats, friendIds, revealedIds, me, scheduled, posts, lastTick: now });
        else set({ lastTick: now });
      },

      devFastForward: (ms) => set((s) => ({
        letters: s.letters.map((l) => (l.status === 'flying' || l.status === 'sunk' ? { ...l, departedAt: l.departedAt - ms, arrivesAt: l.arrivesAt - ms, sunkUntil: l.sunkUntil ? l.sunkUntil - ms : undefined, sunkAt: l.sunkAt ? l.sunkAt - ms : undefined, penalty: l.penalty ? { from: l.penalty.from - ms, until: l.penalty.until - ms } : undefined } : l)),
        scheduled: s.scheduled.map((e) => ({ ...e, at: e.at - ms })), lastTick: s.lastTick - ms,
      })),
      devSpawnPassby: () => {
        const s = get();
        const bot = pick(BOTS);
        const l = makeBotLetter(bot, s.me.location, s.settings.timeScale);
        // 경로에서 실제로 내게 가장 가까운 지점을 4초 뒤에 지나고, 지나간 뒤에도 최소 60초는 더 날도록(개발용 소환만) 비행 시간을 늘린다
        const pAtUser = Math.min(0.98, closestProgress(l, s.me.location));
        const dur = Math.min(30 * 60_000, Math.max(l.arrivesAt - l.departedAt, 60_000 / (1 - pAtUser)));
        const departedAt = Date.now() + 4_000 - pAtUser * dur;
        set({ letters: [{ ...l, departedAt, arrivesAt: departedAt + dur, trail: seedTrail(bot.location, l.destination, [], l.vehicle, Math.max(0, (Date.now() - departedAt) / dur)) }, ...s.letters] });
      },
      devSpawnReply: () => {
        const s = get();
        const bot = BOTS.filter((b) => !s.friendIds.includes(b.id)).sort((a, b) => distanceKm(a.location, s.me.location) - distanceKm(b.location, s.me.location))[0];
        if (!bot) return;
        set({ scheduled: [...s.scheduled, { id: uid(), at: Date.now() + 1000, type: 'bot_reply', payload: { botId: bot.id } }] });
      },
      resetAll: () => set({ onboarded: false, signedIn: false, tourDone: false, me: DEFAULT_ME, letters: [], friendIds: [], revealedIds: [], chats: [], posts: [], notifications: [], passbys: [], scheduled: [], settings: DEFAULT_SETTINGS, focusLetterId: null, focusPoint: null, lastTick: Date.now() }),
    }),
    { name: 'wws-v4', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => { const { focusLetterId, focusPoint, permissions, backend, ...rest } = s as any; return rest; } },
  ),
);

export const selectUnread = (s: State) => s.notifications.filter((n) => !n.read).length;
export const selectUnreadChats = (s: State) => s.chats.filter((c) => c.messages.some((m) => m.senderId !== ME_ID && m.at > c.lastReadAt)).length;
export const selectPendingInbox = (s: State) => s.letters.filter((l) => l.recipientId === ME_ID && l.status === 'delivered').length;
/** 표시 이름: 친구이거나 편지로 드러난 사람은 실명 */
export const displayName = (s: Pick<State, 'me' | 'friendIds' | 'revealedIds'>, id: string) => (id === ME_ID ? s.me.nickname || '나' : s.friendIds.includes(id) || s.revealedIds.includes(id) ? getUser(s, id)?.nickname ?? '???' : '???');
export const isRevealed = (s: Pick<State, 'friendIds' | 'revealedIds'>, id: string) => id === ME_ID || s.friendIds.includes(id) || s.revealedIds.includes(id);
/** 오는 편지의 현재 속도(km/h)와 나와의 거리(km) — 예상 도착 시간은 의도적으로 노출하지 않는다 */
export const incomingStatus = (l: Letter, me: LatLng, now: number, timeScale: number) => {
  const v = VEHICLE_MAP[l.vehicle];
  const snail = !!l.penalty && now < l.penalty.until;
  const speed = Math.round(v.speedKmh * (snail ? SNAIL.factor : 1) * (l.boost === 'instant' ? 40 : l.boost === 'fast' ? 4 : 1));
  const pos = positionOf(l, now);
  return { speedKmh: speed, distanceKm: Math.round(distanceKm(pos, me)), progress: progressOf(l, now), timeScale };
};
export { progressOf, positionOf, VEHICLES };
