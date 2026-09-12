/**
 * 앱 상태 (zustand + AsyncStorage). 서버 없는 로컬 모드에서는 봇 스케줄러가 세계를 돌린다.
 * Firebase 모드(src/services/sync.ts)에서는 서버 이벤트가 같은 액션을 호출한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppNotification, Chat, Gender, Inventory, LatLng, Letter, Passby, PermissionState, Place, PlanId, Post, ScheduledEvent, Settings, TargetFilter, User, VehicleId } from '@/types';
import { BOT_GREETINGS, BOT_LETTERS, BOT_POSTS, BOT_REPLIES, BOT_REPLIES_LETTER, WEATHERS, makeBots } from '@/data/bots';
import { SNAIL, VEHICLE_MAP } from '@/data/vehicles';
import { COIN_REWARDS, PLAN_MAP, PRODUCTS, SHIELD_PER_FRIENDS, type ProductId } from '@/data/plans';
import { bearingDeg, describePlace, destinationPoint, distanceKm, randomLandPoint } from '@/engine/geo';
import { pushLocal } from '@/engine/notify';
import { LANDED_RADIUS_KM, LANDED_WINDOW_MS, PASSBY_RADIUS_KM, aimRouteAt, applySnail, catchWindowMs, minDistanceBetween, planFlight, positionOf, progressOf, rerouteThrough } from '@/engine/sim';

export const BOTS: User[] = makeBots();
const BOT_BY_ID: Record<string, User> = Object.fromEntries(BOTS.map((b) => [b.id, b]));
export const ME_ID = 'me';
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

const DEFAULT_ME: User = {
  id: ME_ID, nickname: '', avatar: '🦊', bio: '', field: 'IT/개발', gender: 'private', job: '학생', hobbies: [],
  location: { lat: 37.5665, lng: 126.978, city: '서울', country: '대한민국' },
  isBot: false, lastActiveAt: Date.now(), stats: { sent: 0, caught: 0, distanceKm: 0, likes: 0 }, stamps: [], coins: 100,
  inventory: { shield: 1, ufo: 0, orbit: 0 }, plan: 'free', shieldMilestone: 0, createdAt: Date.now(),
};
const DEFAULT_SETTINGS: Settings = { timeScale: 240, notifications: true, haptics: true, devMode: false, backgroundLocation: false };

export type ComposeInput = {
  text: string; imageUri?: string; destination?: LatLng; waypoints?: LatLng[]; vehicle: VehicleId; target: TargetFilter; useShield: boolean; isPublic: boolean;
  replyToId?: string; recipientId?: string; friendRequest?: boolean;
};

export type Permissions = { location: PermissionState; backgroundLocation: PermissionState; notifications: PermissionState; pushToken?: string };

export type State = {
  onboarded: boolean;
  me: User;
  letters: Letter[];
  friendIds: string[];
  chats: Chat[];
  posts: Post[];
  notifications: AppNotification[];
  passbys: Passby[];
  scheduled: ScheduledEvent[];
  settings: Settings;
  lastTick: number;
  // transient
  focusLetterId: string | null;
  focusPoint: LatLng | null;
  permissions: Permissions;
  backend: 'local' | 'firebase';

  completeOnboarding: (p: { nickname: string; avatar: string; bio: string; field: string; gender: Gender; job: string; hobbies: string[]; location: Place }) => void;
  updateProfile: (patch: Partial<User>) => void;
  setLocation: (p: Place) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setFocusLetter: (id: string | null) => void;
  setFocusPoint: (p: LatLng | null) => void;
  setPermissions: (patch: Partial<Permissions>) => void;
  setBackend: (b: 'local' | 'firebase') => void;

  sendLetter: (input: ComposeInput) => Letter | { error: string };
  catchLetter: (letterId: string) => Letter | undefined;
  redirectLetter: (letterId: string, action: 'returned' | 'ocean' | 'space') => 'defended' | 'done' | 'immune';
  rerouteLetter: (letterId: string, waypoints: LatLng[]) => 'defended' | 'done' | 'immune' | 'limit';
  snailLetter: (letterId: string) => 'defended' | 'done' | 'immune';
  dismissPassby: (id: string) => void;
  approveReply: (letterId: string) => void;
  declineReply: (letterId: string) => void;
  sendMessage: (otherId: string, text: string) => boolean;
  markChatRead: (otherId: string) => void;
  markNotificationsRead: () => void;
  likePost: (postId: string) => void;
  publishPost: (letterId: string) => void;
  buyWithCoins: (productId: ProductId) => boolean;
  applyPurchase: (productId: ProductId) => void;
  setPlan: (plan: PlanId, expiresAt?: number) => void;
  tick: (now: number) => void;
  devFastForward: (ms: number) => void;
  devSpawnPassby: () => void;
  devSpawnReply: () => void;
  resetAll: () => void;
};

export function getUser(state: Pick<State, 'me'>, id: string): User | undefined {
  return id === ME_ID ? state.me : BOT_BY_ID[id];
}
export function matchesTarget(u: User, t: TargetFilter): boolean {
  if (t.field && u.field !== t.field) return false;
  if (t.gender && u.gender !== t.gender) return false;
  if (t.job && u.job !== t.job) return false;
  if (t.hobby && !u.hobbies.includes(t.hobby)) return false;
  return true;
}
const notif = (type: AppNotification['type'], title: string, body: string, route?: string): AppNotification => ({ id: uid(), type, title, body, at: Date.now(), read: false, route });
const fill = (s: string, bot: User) => s.replace('{city}', bot.location.city).replace('{weather}', pick(WEATHERS));

function botVehicleFor(bot: User): VehicleId {
  const pool: VehicleId[] = ['walk', 'jog', 'sprint', 'bike', 'horse', 'scooter', 'car', 'train', 'plane', 'rocket', 'ufo', 'satellite'];
  const w = [1, 2, 2, 3, 2, 3, 3, 2, 2, 1, 1, 1];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return 'bike';
}

/** 답장은 목적지가 정해져 있으니 거리에 맞춰 1~3분 내 도착하는 수단으로 */
function replyVehicleFor(km: number): VehicleId {
  return km > 1500 ? 'plane' : km > 400 ? 'train' : 'car';
}

function makeBotLetter(bot: User, aimAt: LatLng | null, timeScale: number, startProgress = 0): Letter {
  const vehicle = botVehicleFor(bot);
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
  return {
    id: uid(), senderId: bot.id, text: pick(BOT_LETTERS), origin: bot.location, destination, randomDestination: !aimAt, waypoints: [], vehicle,
    shield: Math.random() < 0.2, target: {}, isPublic: Math.random() < 0.3, status: 'flying', departedAt, arrivesAt: departedAt + plan.durationMs,
    distanceKm: plan.distanceKm, redirects: 0, events: [{ type: 'departed', at: departedAt, place: bot.location.city }], stamp: bot.location.city,
  };
}

function makeBotPost(bot: User, meLoc: LatLng, at = Date.now()): Post {
  return { id: uid(), authorId: bot.id, text: pick(BOT_POSTS), city: bot.location.city, country: bot.location.country, stamp: bot.location.city, vehicle: botVehicleFor(bot), at, likes: Math.floor(rand(0, 120)), likedByMe: false, distanceKm: Math.round(distanceKm(meLoc, bot.location)) };
}

/** 친구 수 마일스톤: 5명마다 방어권 +1 */
function friendMilestone(me: User, friendCount: number): { me: User; granted: number } {
  const target = Math.floor(friendCount / SHIELD_PER_FRIENDS);
  const granted = Math.max(0, target - me.shieldMilestone);
  if (!granted) return { me, granted: 0 };
  return { me: { ...me, shieldMilestone: target, inventory: { ...me.inventory, shield: me.inventory.shield + granted } }, granted };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false, me: DEFAULT_ME, letters: [], friendIds: [], chats: [], posts: [], notifications: [], passbys: [], scheduled: [],
      settings: DEFAULT_SETTINGS, lastTick: Date.now(), focusLetterId: null, focusPoint: null,
      permissions: { location: 'undetermined', backgroundLocation: 'undetermined', notifications: 'undetermined' }, backend: 'local',

      completeOnboarding: (p) => {
        const me: User = { ...get().me, ...p, lastActiveAt: Date.now(), createdAt: Date.now() };
        const ts = get().settings.timeScale;
        const letters: Letter[] = [];
        const shuffled = [...BOTS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 10; i++) {
          const bot = shuffled[i];
          const aim = i < 3;
          let letter = makeBotLetter(bot, aim ? me.location : null, ts, aim ? 0 : rand(0.05, 0.7));
          if (aim) {
            const pAtUser = Math.min(0.95, distanceKm(bot.location, me.location) / letter.distanceKm);
            const dur = letter.arrivesAt - letter.departedAt;
            const departedAt = Date.now() + rand(45_000, 120_000) + i * 50_000 - pAtUser * dur;
            letter = { ...letter, departedAt, arrivesAt: departedAt + dur };
          }
          letters.push(letter);
        }
        const posts = shuffled.slice(10, 34).map((b, i) => makeBotPost(b, me.location, Date.now() - i * rand(600_000, 7_200_000))).sort((a, b) => b.at - a.at);
        set({
          onboarded: true, me, letters, posts,
          scheduled: [
            { id: uid(), at: Date.now() + 30_000, type: 'bot_send', payload: {} },
            { id: uid(), at: Date.now() + 90_000, type: 'bot_post', payload: {} },
          ],
          notifications: [notif('system', '환영해요 🌍', '첫 편지는 걸어서 갑니다. 친구가 늘수록 더 빠른 배달원을 쓸 수 있어요.')],
        });
      },

      updateProfile: (patch) => set((s) => ({ me: { ...s.me, ...patch } })),
      setLocation: (p) => set((s) => ({ me: { ...s.me, location: p } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setFocusLetter: (id) => set({ focusLetterId: id, focusPoint: null }),
      setFocusPoint: (p) => set({ focusPoint: p, focusLetterId: null }),
      setPermissions: (patch) => set((s) => ({ permissions: { ...s.permissions, ...patch } })),
      setBackend: (b) => set({ backend: b }),

      sendLetter: (input) => {
        const s = get();
        const plan = PLAN_MAP[s.me.plan];
        const today = new Date().toDateString();
        const sentToday = s.letters.filter((l) => l.senderId === ME_ID && new Date(l.departedAt).toDateString() === today).length;
        if (sentToday >= plan.dailyLetters) return { error: `오늘 편지 ${plan.dailyLetters}통을 다 썼어요. 플러스로 업그레이드하면 더 보낼 수 있어요.` };
        const ts = s.settings.timeScale;
        const destPt = input.destination ?? randomLandPoint();
        const destination = describePlace(destPt);
        const waypoints = input.waypoints ?? [];
        const plan_ = planFlight(s.me.location, destPt, waypoints, input.vehicle, ts);
        const now = Date.now();
        const v = VEHICLE_MAP[input.vehicle];
        const inv: Inventory = { ...s.me.inventory };
        const shield = input.useShield && inv.shield > 0;
        if (shield) inv.shield -= 1;
        if (v.premiumItem === 'ufo') inv.ufo = Math.max(0, inv.ufo - 1);
        if (v.premiumItem === 'orbit') inv.orbit = Math.max(0, inv.orbit - 1);

        const letter: Letter = {
          id: uid(), senderId: ME_ID, recipientId: input.recipientId, replyToId: input.replyToId, friendRequest: input.friendRequest,
          text: input.text, imageUri: input.imageUri, origin: s.me.location, destination, randomDestination: !input.destination, waypoints,
          vehicle: input.vehicle, shield, target: input.target, isPublic: input.isPublic, status: 'flying', departedAt: now, arrivesAt: now + plan_.durationMs,
          distanceKm: plan_.distanceKm, redirects: 0, events: [{ type: 'departed', at: now, place: s.me.location.city }], stamp: s.me.location.city,
        };
        const sched: ScheduledEvent[] = [];
        if (!input.recipientId) {
          const candidates = BOTS.filter((b) => matchesTarget(b, input.target));
          const nearDest = candidates.map((b) => ({ b, d: distanceKm(b.location, destPt) })).sort((x, y) => x.d - y.d);
          const catcher = nearDest[0] && (nearDest[0].d < 2500 || Math.random() < 0.35) ? nearDest[0].b : null;
          if (catcher && Math.random() < 0.9) sched.push({ id: uid(), at: letter.arrivesAt + rand(15_000, 60_000), type: 'bot_catch', payload: { letterId: letter.id, botId: catcher.id } });
          if (!v.immune && Math.random() < 0.15) sched.push({ id: uid(), at: now + plan_.durationMs * rand(0.3, 0.7), type: 'bot_mischief', payload: { letterId: letter.id, botId: pick(BOTS).id } });
        }
        const posts = input.isPublic
          ? [{ id: uid(), letterId: letter.id, authorId: ME_ID, text: input.text, imageUri: input.imageUri, city: s.me.location.city, country: s.me.location.country, stamp: s.me.location.city, vehicle: input.vehicle, at: now, likes: 0, likedByMe: false, distanceKm: Math.round(plan_.distanceKm) }, ...s.posts]
          : s.posts;
        if (input.isPublic) sched.push({ id: uid(), at: now + rand(20_000, 90_000), type: 'bot_like', payload: { postId: posts[0].id } });
        set({
          letters: [letter, ...s.letters], scheduled: [...s.scheduled, ...sched], posts,
          me: { ...s.me, inventory: inv, coins: s.me.coins + COIN_REWARDS.send, stats: { ...s.me.stats, sent: s.me.stats.sent + 1, distanceKm: s.me.stats.distanceKm + Math.round(plan_.distanceKm) } },
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
        const updated: Letter = { ...letter, status: 'caught', caughtBy: ME_ID, caughtAt: now, catchPlace: place, events: [...letter.events, { type: 'caught', at: now, by: ME_ID, place }] };
        const stamps = s.me.stamps.includes(letter.stamp) ? s.me.stamps : [...s.me.stamps, letter.stamp];
        set({
          letters: s.letters.map((l) => (l.id === letterId ? updated : l)),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'caught' } : p)),
          me: { ...s.me, stamps, coins: s.me.coins + COIN_REWARDS.catch, stats: { ...s.me.stats, caught: s.me.stats.caught + 1 } },
          notifications: [notif('reward', `+${COIN_REWARDS.catch} 코인`, `${letter.stamp}에서 온 편지를 잡았어요. 답장을 보내 친구가 되어보세요`, `/letter/${letter.id}`), ...s.notifications],
        });
        return updated;
      },

      redirectLetter: (letterId, action) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l) return 'done';
        const now = Date.now();
        if (VEHICLE_MAP[l.vehicle].immune) { set({ passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) }); return 'immune'; }
        if (l.shield) {
          set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) });
          return 'defended';
        }
        set({
          letters: s.letters.map((x) => (x.id === letterId ? { ...x, status: action, events: [...x.events, { type: action, at: now, by: ME_ID, place: s.me.location.city }] } : x)),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: action } : p)),
          me: { ...s.me, coins: s.me.coins + COIN_REWARDS.mischief },
        });
        return 'done';
      },

      rerouteLetter: (letterId, waypoints) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || l.status !== 'flying') return 'done';
        const max = PLAN_MAP[s.me.plan].maxWaypoints;
        if (waypoints.length < 1 || waypoints.length > max) return 'limit';
        const now = Date.now();
        if (VEHICLE_MAP[l.vehicle].immune) { set({ passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) }); return 'immune'; }
        if (l.shield) {
          set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) });
          return 'defended';
        }
        const patch = rerouteThrough(l, now, waypoints, s.settings.timeScale);
        set({
          letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...patch, redirects: x.redirects + 1, events: [...x.events, { type: 'rerouted', at: now, by: ME_ID, place: s.me.location.city }] } : x)),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'rerouted' } : p)),
          me: { ...s.me, coins: s.me.coins + COIN_REWARDS.mischief },
          focusLetterId: letterId,
        });
        return 'done';
      },

      snailLetter: (letterId) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || l.status !== 'flying') return 'done';
        const now = Date.now();
        if (VEHICLE_MAP[l.vehicle].immune) { set({ passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) }); return 'immune'; }
        if (l.shield) {
          set({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: ME_ID, place: s.me.location.city }] } : x)), passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'defended' } : p)) });
          return 'defended';
        }
        set({
          letters: s.letters.map((x) => (x.id === letterId ? { ...x, ...applySnail(x, now), events: [...x.events, { type: 'snail', at: now, by: ME_ID, place: s.me.location.city }] } : x)),
          passbys: s.passbys.map((p) => (p.letterId === letterId ? { ...p, resolved: 'snail' } : p)),
          me: { ...s.me, coins: s.me.coins + COIN_REWARDS.mischief },
        });
        return 'done';
      },

      dismissPassby: (id) => set((s) => ({ passbys: s.passbys.map((p) => (p.id === id && !p.resolved ? { ...p, resolved: 'missed' } : p)) })),

      approveReply: (letterId) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || l.status !== 'delivered' || l.recipientId !== ME_ID) return;
        const other = l.senderId;
        const now = Date.now();
        const friendIds = s.friendIds.includes(other) ? s.friendIds : [...s.friendIds, other];
        const { me: me1, granted } = friendMilestone({ ...s.me, coins: s.me.coins + COIN_REWARDS.friend }, friendIds.length);
        const bot = BOT_BY_ID[other];
        const hello = bot ? [{ id: uid(), senderId: other, text: fill(pick(BOT_GREETINGS), bot), at: now + 1 }] : [];
        const chats = s.chats.some((c) => c.otherId === other) ? s.chats.map((c) => (c.otherId === other ? { ...c, messages: [...c.messages, ...hello] } : c)) : [{ id: other, otherId: other, messages: hello, lastReadAt: 0, since: now }, ...s.chats];
        const noti = [notif('approved', `🤝 ${bot?.nickname ?? '???'} 님과 친구가 됐어요`, `이제 지연 없는 실시간 채팅 · 50km 반경 위치 공유 · +${COIN_REWARDS.friend} 코인`, `/chat/${other}`)];
        if (granted) noti.push(notif('reward', `🛡️ 방어권 +${granted}`, `친구 ${friendIds.length}명 달성 보너스`));
        set({
          letters: s.letters.map((x) => (x.id === letterId || x.id === l.replyToId ? { ...x, status: 'approved', events: [...x.events, { type: 'approved', at: now, by: ME_ID }] } : x)),
          friendIds, chats, me: me1, notifications: [...noti, ...s.notifications],
        });
      },

      declineReply: (letterId) => set((s) => ({ letters: s.letters.map((x) => (x.id === letterId ? { ...x, status: 'declined', events: [...x.events, { type: 'declined', at: Date.now(), by: ME_ID }] } : x)) })),

      sendMessage: (otherId, text) => {
        const s = get();
        if (!s.friendIds.includes(otherId)) return false;
        const chat = s.chats.find((c) => c.otherId === otherId) ?? { id: otherId, otherId, messages: [], lastReadAt: Date.now(), since: Date.now() };
        const msg = { id: uid(), senderId: ME_ID, text, at: Date.now() };
        const updated: Chat = { ...chat, messages: [...chat.messages, msg], lastReadAt: Date.now() };
        const chats = s.chats.some((c) => c.otherId === otherId) ? s.chats.map((c) => (c.otherId === otherId ? updated : c)) : [updated, ...s.chats];
        const sched = [...s.scheduled];
        if (BOT_BY_ID[otherId]) sched.push({ id: uid(), at: Date.now() + rand(2_500, 9_000), type: 'bot_chat', payload: { botId: otherId } });
        set({ chats, scheduled: sched });
        return true;
      },
      markChatRead: (otherId) => set((s) => ({ chats: s.chats.map((c) => (c.otherId === otherId ? { ...c, lastReadAt: Date.now() } : c)) })),
      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      likePost: (postId) => set((s) => ({ posts: s.posts.map((p) => (p.id === postId ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) } : p)) })),
      publishPost: (letterId) => {
        const s = get();
        const l = s.letters.find((x) => x.id === letterId);
        if (!l || s.posts.some((p) => p.letterId === letterId)) return;
        const post: Post = { id: uid(), letterId, authorId: l.senderId, text: l.text, imageUri: l.imageUri, city: l.origin.city, country: l.origin.country, stamp: l.stamp, vehicle: l.vehicle, at: Date.now(), likes: 0, likedByMe: false, distanceKm: Math.round(l.distanceKm) };
        set({ posts: [post, ...s.posts], letters: s.letters.map((x) => (x.id === letterId ? { ...x, isPublic: true } : x)), scheduled: [...s.scheduled, { id: uid(), at: Date.now() + rand(15_000, 60_000), type: 'bot_like', payload: { postId: post.id } }] });
      },

      buyWithCoins: (productId) => {
        const s = get();
        const p = PRODUCTS.find((x) => x.id === productId);
        if (!p || !p.coins || s.me.coins < p.coins) return false;
        set({ me: { ...s.me, coins: s.me.coins - p.coins, inventory: { shield: s.me.inventory.shield + (p.grants.shield ?? 0), ufo: s.me.inventory.ufo + (p.grants.ufo ?? 0), orbit: s.me.inventory.orbit + (p.grants.orbit ?? 0) } } });
        return true;
      },
      applyPurchase: (productId) => {
        const s = get();
        const p = PRODUCTS.find((x) => x.id === productId);
        if (!p) return;
        set({ me: { ...s.me, coins: s.me.coins + (p.grants.coins ?? 0), inventory: { shield: s.me.inventory.shield + (p.grants.shield ?? 0), ufo: s.me.inventory.ufo + (p.grants.ufo ?? 0), orbit: s.me.inventory.orbit + (p.grants.orbit ?? 0) } }, notifications: [notif('reward', `${p.emoji} ${p.name} 구매 완료`, p.desc), ...s.notifications] });
      },
      setPlan: (plan, expiresAt) => {
        const s = get();
        const P = PLAN_MAP[plan];
        const upgrade = plan !== 'free' && plan !== s.me.plan;
        set({
          me: { ...s.me, plan, planExpiresAt: expiresAt, inventory: upgrade ? { shield: s.me.inventory.shield + P.monthlyShields, ufo: s.me.inventory.ufo + P.monthlyUfo, orbit: s.me.inventory.orbit + P.monthlyOrbit } : s.me.inventory },
          notifications: upgrade ? [notif('reward', `${P.badge ?? ''} ${P.name} 시작!`, `이번 달 지급: 방어권 ${P.monthlyShields}${P.monthlyUfo ? ` · UFO ${P.monthlyUfo}` : ''}${P.monthlyOrbit ? ` · 위성 ${P.monthlyOrbit}` : ''} · 경유지 ${P.maxWaypoints}개`), ...s.notifications] : s.notifications,
        });
      },

      tick: (now) => {
        const s = get();
        if (!s.onboarded) return;
        const prev = s.lastTick;
        const local = s.backend === 'local';
        let { letters, passbys, notifications, chats, friendIds, me, scheduled, posts } = s;
        let changed = false;
        const pushes: { title: string; body: string; route?: string }[] = [];

        // 1) 도착 처리
        letters = letters.map((l) => {
          if (l.status === 'flying' && now >= l.arrivesAt) {
            changed = true;
            if (l.recipientId) {
              // 답장(회수) 편지 → 수신자 우편함
              if (l.recipientId === ME_ID) {
                notifications = [notif('reply', '📬 답장이 도착했어요', `${l.origin.city}에서 온 답장. 승인하면 실시간 채팅이 시작돼요`, `/letter/${l.id}`), ...notifications];
                pushes.push({ title: '📬 답장이 도착했어요', body: `${l.origin.city}에서 온 답장. 승인하면 채팅 시작`, route: `/letter/${l.id}` });
              } else if (local && l.friendRequest && BOT_BY_ID[l.recipientId]) {
                scheduled = [...scheduled, { id: uid(), at: now + rand(10_000, 40_000), type: 'bot_approve', payload: { letterId: l.id } }];
                notifications = [notif('landed', `📬 답장이 ${l.destination.city}에 도착`, '상대가 승인하면 실시간 채팅이 열려요', `/letter/${l.id}`), ...notifications];
              }
              return { ...l, status: 'delivered', landedAt: now, events: [...l.events, { type: 'delivered', at: now, place: l.destination.city }] };
            }
            const nearMe = distanceKm(l.destination, me.location) <= LANDED_RADIUS_KM;
            if (l.senderId === ME_ID) notifications = [notif('landed', `📍 ${l.destination.city}에 착륙`, '누군가 집어갈 때까지 기다려요', `/letter/${l.id}`), ...notifications];
            else if (nearMe && !passbys.some((p) => p.letterId === l.id)) {
              const canCatch = matchesTarget(me, l.target);
              passbys = [{ id: uid(), letterId: l.id, at: now, expiresAt: now + LANDED_WINDOW_MS, canCatch }, ...passbys];
              notifications = [notif('passby', '📍 근처에 편지가 착륙했어요', `${l.origin.city}에서 온 ${VEHICLE_MAP[l.vehicle].name}`, `/catch/${l.id}`), ...notifications];
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

        // 2) 통과 판정 (내 상공 150km)
        for (const l of letters) {
          if (l.status !== 'flying' || l.senderId === ME_ID || l.recipientId) continue;
          if (passbys.some((p) => p.letterId === l.id)) continue;
          if (minDistanceBetween(l, prev, now, me.location) <= PASSBY_RADIUS_KM) {
            changed = true;
            const canCatch = matchesTarget(me, l.target);
            const v = VEHICLE_MAP[l.vehicle];
            passbys = [{ id: uid(), letterId: l.id, at: now, expiresAt: now + catchWindowMs(l.vehicle), canCatch }, ...passbys];
            const title = `${v.emoji} ${v.name}이(가) 머리 위를 지나가요!`;
            const body = canCatch ? `${l.origin.city}에서 출발한 편지. 잡거나 경로를 바꿔보세요` : '조건이 맞는 사람만 잡을 수 있어요 (경로 변경은 가능)';
            notifications = [notif('passby', title, body, `/catch/${l.id}`), ...notifications];
            pushes.push({ title, body, route: `/catch/${l.id}` });
            letters = letters.map((x) => (x.id === l.id ? { ...x, events: [...x.events, { type: 'passby', at: now, place: me.location.city }] } : x));
          }
        }

        // 3) 잡기 창 만료
        passbys = passbys.map((p) => (!p.resolved && now > p.expiresAt ? ((changed = true), { ...p, resolved: 'missed' as const }) : p));
        if (passbys.length > 40) passbys = passbys.slice(0, 40);

        // 4) 봇 스케줄 (로컬 모드)
        const due = local ? scheduled.filter((e) => e.at <= now) : [];
        if (due.length) {
          changed = true;
          scheduled = scheduled.filter((e) => e.at > now);
          for (const e of due) {
            switch (e.type) {
              case 'bot_send': {
                const active = letters.filter((l) => l.status === 'flying' && l.senderId !== ME_ID).length;
                if (active < 14) letters = [makeBotLetter(pick(BOTS), Math.random() < 0.45 ? me.location : null, s.settings.timeScale), ...letters];
                scheduled.push({ id: uid(), at: now + rand(25_000, 60_000), type: 'bot_send', payload: {} });
                break;
              }
              case 'bot_post': {
                posts = [makeBotPost(pick(BOTS), me.location), ...posts].slice(0, 80);
                scheduled.push({ id: uid(), at: now + rand(90_000, 240_000), type: 'bot_post', payload: {} });
                break;
              }
              case 'bot_like': {
                const post = posts.find((p) => p.id === e.payload.postId);
                if (post) {
                  posts = posts.map((p) => (p.id === post.id ? { ...p, likes: p.likes + 1 } : p));
                  me = { ...me, coins: me.coins + COIN_REWARDS.like, stats: { ...me.stats, likes: me.stats.likes + 1 } };
                  notifications = [notif('like', '❤️ ??? 님이 내 엽서를 좋아해요', post.text.slice(0, 40), '/community'), ...notifications];
                  if (Math.random() < 0.5) scheduled.push({ id: uid(), at: now + rand(30_000, 120_000), type: 'bot_like', payload: { postId: post.id } });
                }
                break;
              }
              case 'bot_catch': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = BOT_BY_ID[e.payload.botId];
                if (!l || !bot || (l.status !== 'landed' && l.status !== 'flying')) break;
                letters = letters.map((x) => (x.id === l.id ? { ...x, status: 'caught', caughtBy: bot.id, caughtAt: now, catchPlace: bot.location.city, events: [...x.events, { type: 'caught', at: now, by: bot.id, place: bot.location.city }] } : x));
                notifications = [notif('caught', `🎉 ${bot.location.city}에서 누군가 내 편지를 잡았어요`, '답장이 오면 승인해서 친구가 되어보세요', `/letter/${l.id}`), ...notifications];
                pushes.push({ title: `🎉 ${bot.location.city}에서 누군가 내 편지를 잡았어요`, body: '곧 답장이 날아올지도 몰라요', route: `/letter/${l.id}` });
                me = { ...me, coins: me.coins + COIN_REWARDS.caughtByOther };
                if (Math.random() < 0.75 && !friendIds.includes(bot.id)) scheduled.push({ id: uid(), at: now + rand(10_000, 40_000), type: 'bot_reply', payload: { botId: bot.id, letterId: l.id } });
                break;
              }
              case 'bot_reply': {
                // 봇이 답장 편지(친구 요청 포함)를 내 위치로 날림 → 도착하면 내가 승인
                const bot = BOT_BY_ID[e.payload.botId];
                if (!bot || friendIds.includes(bot.id)) break;
                const km = distanceKm(bot.location, me.location);
                const vehicle = replyVehicleFor(km);
                const plan = planFlight(bot.location, me.location, [], vehicle, s.settings.timeScale);
                const reply: Letter = {
                  id: uid(), senderId: bot.id, recipientId: ME_ID, replyToId: e.payload.letterId, friendRequest: true, text: pick(BOT_REPLIES_LETTER), origin: bot.location, destination: me.location,
                  randomDestination: false, waypoints: [], vehicle, shield: true, target: {}, isPublic: false, status: 'flying', departedAt: now, arrivesAt: now + plan.durationMs, distanceKm: plan.distanceKm,
                  redirects: 0, events: [{ type: 'departed', at: now, place: bot.location.city }], stamp: bot.location.city,
                };
                letters = [reply, ...letters];
                notifications = [notif('reply', `✉️ ${bot.location.city}에서 답장이 출발했어요`, `${VEHICLE_MAP[vehicle].name}로 오는 중 · 도착하면 승인할 수 있어요`, `/letter/${reply.id}`), ...notifications];
                break;
              }
              case 'bot_approve': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = l ? BOT_BY_ID[l.recipientId ?? ''] : undefined;
                if (!l || !bot || l.status !== 'delivered') break;
                if (Math.random() < 0.1) {
                  letters = letters.map((x) => (x.id === l.id ? { ...x, status: 'declined', events: [...x.events, { type: 'declined', at: now, by: bot.id }] } : x));
                  notifications = [notif('system', '😢 상대가 답장을 승인하지 않았어요', '다른 편지를 날려보세요', `/letter/${l.id}`), ...notifications];
                  break;
                }
                if (!friendIds.includes(bot.id)) friendIds = [...friendIds, bot.id];
                const ms = friendMilestone({ ...me, coins: me.coins + COIN_REWARDS.friend }, friendIds.length);
                me = ms.me;
                const hello = { id: uid(), senderId: bot.id, text: fill(pick(BOT_GREETINGS), bot), at: now };
                chats = chats.some((c) => c.otherId === bot.id) ? chats.map((c) => (c.otherId === bot.id ? { ...c, messages: [...c.messages, hello] } : c)) : [{ id: bot.id, otherId: bot.id, messages: [hello], lastReadAt: 0, since: now }, ...chats];
                letters = letters.map((x) => (x.id === l.id || x.id === l.replyToId ? { ...x, status: 'approved', events: [...x.events, { type: 'approved', at: now, by: bot.id }] } : x));
                notifications = [notif('approved', `🤝 ${bot.nickname} 님이 답장을 승인했어요`, `이제 실시간 채팅 · 50km 반경 위치 공유 · +${COIN_REWARDS.friend} 코인`, `/chat/${bot.id}`), ...notifications];
                if (ms.granted) notifications = [notif('reward', `🛡️ 방어권 +${ms.granted}`, `친구 ${friendIds.length}명 달성 보너스`), ...notifications];
                pushes.push({ title: `🤝 ${bot.nickname} 님이 답장을 승인했어요`, body: '실시간 채팅이 열렸어요', route: `/chat/${bot.id}` });
                break;
              }
              case 'bot_chat': {
                const bot = BOT_BY_ID[e.payload.botId];
                if (!bot) break;
                const reply = { id: uid(), senderId: bot.id, text: fill(pick(BOT_REPLIES), bot), at: now };
                chats = chats.map((c) => (c.otherId === bot.id ? { ...c, messages: [...c.messages, reply] } : c));
                notifications = [notif('chat', `💬 ${bot.nickname}`, reply.text, `/chat/${bot.id}`), ...notifications];
                pushes.push({ title: bot.nickname, body: reply.text, route: `/chat/${bot.id}` });
                break;
              }
              case 'bot_mischief': {
                const l = letters.find((x) => x.id === e.payload.letterId);
                const bot = BOT_BY_ID[e.payload.botId];
                if (!l || !bot || l.status !== 'flying') break;
                if (l.shield) {
                  letters = letters.map((x) => (x.id === l.id ? { ...x, shield: false, events: [...x.events, { type: 'defended', at: now, by: bot.id, place: bot.location.city }] } : x));
                  notifications = [notif('defended', '🛡️ 방어권이 장난을 막았어요', `${bot.location.city}에서 누군가 편지를 건드렸지만 튕겨냈어요`, `/letter/${l.id}`), ...notifications];
                  pushes.push({ title: '🛡️ 방어권이 장난을 막았어요', body: '편지는 무사히 가는 중', route: `/letter/${l.id}` });
                } else {
                  const action = pick(['rerouted', 'snail', 'returned', 'ocean', 'space'] as const);
                  if (action === 'rerouted') {
                    const wp = destinationPoint(bot.location, Math.random() * 360, rand(200, 900));
                    letters = letters.map((x) => (x.id === l.id ? { ...x, ...rerouteThrough(x, now, [wp], s.settings.timeScale), redirects: x.redirects + 1, events: [...x.events, { type: 'rerouted', at: now, by: bot.id, place: bot.location.city }] } : x));
                    notifications = [notif('mischief', '🧭 누군가 내 편지의 경로를 바꿨어요', `${bot.location.city} 근처로 돌아가는 중. 방어권이 있으면 막을 수 있어요`, `/letter/${l.id}`), ...notifications];
                  } else if (action === 'snail') {
                    letters = letters.map((x) => (x.id === l.id ? { ...x, ...applySnail(x, now), events: [...x.events, { type: 'snail', at: now, by: bot.id, place: bot.location.city }] } : x));
                    notifications = [notif('mischief', '🐌 내 편지에 달팽이가 붙었어요', `${SNAIL.durationMs / 60_000}분 동안 느려져요`, `/letter/${l.id}`), ...notifications];
                  } else {
                    letters = letters.map((x) => (x.id === l.id ? { ...x, status: action, events: [...x.events, { type: action, at: now, by: bot.id, place: bot.location.city }] } : x));
                    const msg = action === 'ocean' ? '😱 내 편지가 바다에 빠졌어요' : action === 'space' ? '🚀 내 편지가 우주로 날아갔어요' : '↩️ 내 편지가 되돌아오고 있어요';
                    notifications = [notif('mischief', msg, '방어권을 장착하면 막을 수 있어요', '/store'), ...notifications];
                  }
                  pushes.push({ title: '😈 누군가 내 편지에 장난을 쳤어요', body: '방어권으로 막을 수 있어요', route: `/letter/${l.id}` });
                }
                break;
              }
            }
          }
        }
        if (local && !scheduled.some((e) => e.type === 'bot_send')) { scheduled = [...scheduled, { id: uid(), at: now + 30_000, type: 'bot_send', payload: {} }]; changed = true; }
        if (local && !scheduled.some((e) => e.type === 'bot_post')) { scheduled = [...scheduled, { id: uid(), at: now + 120_000, type: 'bot_post', payload: {} }]; changed = true; }

        if (letters.length > 90) {
          const keep = letters.filter((l) => l.senderId === ME_ID || l.recipientId === ME_ID || l.status === 'flying' || l.caughtBy === ME_ID || now - (l.landedAt ?? l.arrivesAt) < 3_600_000);
          if (keep.length !== letters.length) { letters = keep; changed = true; }
        }
        if (notifications.length > 80) notifications = notifications.slice(0, 80);
        if (s.settings.notifications) for (const p of pushes) pushLocal(p.title, p.body, { route: p.route });
        if (changed) set({ letters, passbys, notifications, chats, friendIds, me, scheduled, posts, lastTick: now });
        else set({ lastTick: now });
      },

      devFastForward: (ms) => set((s) => ({
        letters: s.letters.map((l) => (l.status === 'flying' ? { ...l, departedAt: l.departedAt - ms, arrivesAt: l.arrivesAt - ms, penalty: l.penalty ? { from: l.penalty.from - ms, until: l.penalty.until - ms } : undefined } : l)),
        scheduled: s.scheduled.map((e) => ({ ...e, at: e.at - ms })), lastTick: s.lastTick - ms,
      })),
      devSpawnPassby: () => {
        const s = get();
        const bot = pick(BOTS);
        const l = makeBotLetter(bot, s.me.location, s.settings.timeScale);
        const pAtUser = Math.min(0.95, distanceKm(bot.location, s.me.location) / l.distanceKm);
        const dur = l.arrivesAt - l.departedAt;
        const departedAt = Date.now() + 4_000 - pAtUser * dur;
        set({ letters: [{ ...l, departedAt, arrivesAt: departedAt + dur }, ...s.letters] });
      },
      devSpawnReply: () => {
        const s = get();
        // 가까운 봇부터(도착이 빠르도록) 아직 친구가 아닌 봇 중 하나
        const bot = BOTS.filter((b) => !s.friendIds.includes(b.id)).sort((a, b) => distanceKm(a.location, s.me.location) - distanceKm(b.location, s.me.location))[0];
        if (!bot) return;
        set({ scheduled: [...s.scheduled, { id: uid(), at: Date.now() + 1000, type: 'bot_reply', payload: { botId: bot.id } }] });
      },
      resetAll: () => set({ onboarded: false, me: DEFAULT_ME, letters: [], friendIds: [], chats: [], posts: [], notifications: [], passbys: [], scheduled: [], settings: DEFAULT_SETTINGS, focusLetterId: null, focusPoint: null, lastTick: Date.now() }),
    }),
    {
      name: 'wws-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => { const { focusLetterId, focusPoint, permissions, backend, ...rest } = s as any; return rest; },
    },
  ),
);

export const selectUnread = (s: State) => s.notifications.filter((n) => !n.read).length;
export const selectUnreadChats = (s: State) => s.chats.filter((c) => c.messages.some((m) => m.senderId !== ME_ID && m.at > c.lastReadAt)).length;
export const selectPendingReplies = (s: State) => s.letters.filter((l) => l.recipientId === ME_ID && l.status === 'delivered').length;
export const displayName = (s: Pick<State, 'me' | 'friendIds'>, id: string) => (id === ME_ID ? s.me.nickname || '나' : s.friendIds.includes(id) ? getUser(s, id)?.nickname ?? '???' : '???');
export { progressOf, positionOf };
