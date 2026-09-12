/**
 * Edge Function 공통 — DB 접근(service role), 코인 원장, 푸시 큐, geohash, 규칙 상수. Deno 전용 API 는 쓰지 않는다(타입체크 가능).
 */
import type { LatLng } from './geo';

export const RULES = {
  COIN_REWARDS: { catch: 10, friend: 25, caughtByOther: 5, received: 3, send: 2, mischief: 1, like: 1, comment: 1 },
  DAILY_FREE_COIN_CAP: 60,
  OCEAN_RESCUE_COINS: 50,
  SHIELD_PER_FRIENDS: 5,
  ITEMS: { shield5: { coins: 150, grants: { shield: 5 } }, peek5: { coins: 120, grants: { peek: 5 } }, pull1: { coins: 150, grants: { pull: 1 } }, direct1: { coins: 300, grants: { direct: 1 } }, ufo1: { coins: 120, grants: { ufo: 1 } }, orbit1: { coins: 220, grants: { orbit: 1 } } } as Record<string, { coins: number; grants: Record<string, number> }>,
  PACKS: { wws_sc_300: { coins: 300, krw: 3900 }, wws_sc_800: { coins: 800, krw: 8900 }, wws_sc_2000: { coins: 2000, krw: 19900 }, wws_sc_5500: { coins: 5500, krw: 49000 }, wws_sc_12000: { coins: 12000, krw: 99000 } } as Record<string, { coins: number; krw: number }>,
  PLAN_GRANTS: { wws_plus_monthly: { plan: 'plus', shield: 5, ufo: 0, orbit: 0, coins: 300 }, wws_pro_monthly: { plan: 'pro', shield: 15, ufo: 3, orbit: 1, coins: 1000 } } as Record<string, { plan: 'plus' | 'pro'; shield: number; ufo: number; orbit: number; coins: number }>,
  REPLY_BOOST: { fast: { coins: 80, factor: 4 }, instant: { coins: 200, seconds: 60 } },
  PASSBY_PUSH_DAILY_CAP: 12,
  PASSBY_PER_LETTER_PER_TICK: 200,
  HOT_CELL_USERS: 5000, HOT_CELL_SAMPLE: 300,
  LOCATION_MIN_INTERVAL_MS: 60_000,
  TIME_SCALE: 60,
} as const;

export function rentalCoins(speedKmh: number): number { return speedKmh < 100 ? 40 : speedKmh < 300 ? 80 : speedKmh < 1000 ? 150 : speedKmh < 3000 ? 250 : 400; }
export const discounted = (coins: number, plan: 'free' | 'plus' | 'pro') => Math.round(coins * (1 - (plan === 'pro' ? 0.5 : plan === 'plus' ? 0.2 : 0)));

/** geohash (base32) */
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
export function geohash(p: LatLng, precision: number): string {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180, even = true, bit = 0, ch = 0, out = '';
  while (out.length < precision) {
    if (even) { const mid = (minLng + maxLng) / 2; if (p.lng >= mid) { ch |= 1 << (4 - bit); minLng = mid; } else maxLng = mid; }
    else { const mid = (minLat + maxLat) / 2; if (p.lat >= mid) { ch |= 1 << (4 - bit); minLat = mid; } else maxLat = mid; }
    even = !even;
    if (bit < 4) bit++; else { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}
export const cells4 = (points: LatLng[]) => [...new Set(points.map((p) => geohash(p, 4)))];

/** 최소한의 DB 인터페이스 (supabase-js 클라이언트를 감싼다) — 함수들이 테스트에서 가짜 DB 로 대체 가능 */
export interface Db {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }>;
}
export type UserRow = { id: string; nickname: string; plan: 'free' | 'plus' | 'pro'; coins: number; inventory: Record<string, number>; quota: Record<string, any>; stats: Record<string, number>; friend_ids: string[]; revealed_ids: string[]; shield_milestone: number; stamps: string[]; field: string; gender: string; job: string; hobbies: string[]; city: string; country: string };

export async function getUser(db: Db, id: string): Promise<UserRow> {
  const { data, error } = await db.from('users').select('*').eq('id', id).single();
  if (error || !data) throw new Error('user not found');
  return data as UserRow;
}
/** 코인 변경 + 원장 기록 (잔액 음수 금지) */
export async function coinDelta(db: Db, user: UserRow, delta: number, reason: string, ref?: string): Promise<UserRow> {
  const balance = user.coins + delta;
  if (balance < 0) throw new Error('nofunds');
  const { error } = await db.from('users').update({ coins: balance }).eq('id', user.id).eq('coins', user.coins); // 낙관적 잠금
  if (error) throw new Error('coin update failed');
  await db.from('coin_ledger').insert({ user_id: user.id, delta, reason, ref, balance_after: balance });
  return { ...user, coins: balance };
}
/** 플레이 보상은 하루 상한 */
export async function earn(db: Db, user: UserRow, amount: number, reason: string): Promise<UserRow> {
  const today = new Date().toISOString().slice(0, 10);
  const q = user.quota.date === today ? user.quota : { ...user.quota, date: today, peeks: 0, pulls: 0, earned: 0 };
  const give = Math.min(amount, Math.max(0, RULES.DAILY_FREE_COIN_CAP - (q.earned ?? 0)));
  if (!give) return user;
  const u = await coinDelta(db, { ...user, quota: q }, give, reason);
  await db.from('users').update({ quota: { ...q, earned: (q.earned ?? 0) + give } }).eq('id', user.id);
  return { ...u, quota: { ...q, earned: (q.earned ?? 0) + give } };
}
export async function notify(db: Db, userId: string, type: string, title: string, body: string, route?: string, priority = 5) {
  await db.from('notifications').insert({ user_id: userId, type, title, body, route });
  await db.from('push_queue').insert({ user_id: userId, title, body, route, kind: type, priority });
}
export function chatId(a: string, b: string) { return a < b ? `${a}_${b}` : `${b}_${a}`; }
export async function makeFriends(db: Db, a: UserRow, bId: string): Promise<{ a: UserRow; granted: number }> {
  const friend_ids = a.friend_ids.includes(bId) ? a.friend_ids : [...a.friend_ids, bId];
  const target = Math.floor(friend_ids.length / RULES.SHIELD_PER_FRIENDS);
  const granted = Math.max(0, target - a.shield_milestone);
  const inventory = granted ? { ...a.inventory, shield: (a.inventory.shield ?? 0) + granted } : a.inventory;
  await db.from('users').update({ friend_ids, inventory, shield_milestone: Math.max(target, a.shield_milestone) }).eq('id', a.id);
  const b = await getUser(db, bId);
  const bf = b.friend_ids.includes(a.id) ? b.friend_ids : [...b.friend_ids, a.id];
  const bt = Math.floor(bf.length / RULES.SHIELD_PER_FRIENDS); const bg = Math.max(0, bt - b.shield_milestone);
  await db.from('users').update({ friend_ids: bf, inventory: bg ? { ...b.inventory, shield: (b.inventory.shield ?? 0) + bg } : b.inventory, shield_milestone: Math.max(bt, b.shield_milestone) }).eq('id', bId);
  await db.from('chats').upsert({ id: chatId(a.id, bId), members: [a.id, bId] });
  const ua = await earn(db, { ...a, friend_ids, inventory, shield_milestone: Math.max(target, a.shield_milestone) }, RULES.COIN_REWARDS.friend, 'friend');
  await earn(db, b, RULES.COIN_REWARDS.friend, 'friend');
  return { a: ua, granted };
}
export function matchesTarget(u: UserRow, t: Record<string, string | undefined>): boolean {
  if (t.field && u.field !== t.field) return false;
  if (t.gender && u.gender !== t.gender) return false;
  if (t.job && u.job !== t.job) return false;
  if (t.hobby && !u.hobbies.includes(t.hobby)) return false;
  return true;
}
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' } });
export const fail = (msg: string, status = 400) => json({ error: msg }, status);
