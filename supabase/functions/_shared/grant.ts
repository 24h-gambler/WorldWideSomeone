/**
 * 결제 지급 공통 — purchase-webhook(RevenueCat 웹훅)과 rc-grant(앱이 호출하는 서버 검증) 가 같이 쓴다.
 * 멱등 키 = 스토어 트랜잭션 id (purchases.id primary key). 먼저 insert 로 "지급권"을 선점하고,
 * 이미 있으면(23505) 중복이라 아무것도 하지 않는다 → 두 경로가 동시에 와도 한 번만 지급된다.
 * Deno 전용 API 는 쓰지 않는다(타입체크 가능).
 */
import { RULES, getUser, type Db, type UserRow } from './core.ts';

export type PlanId = 'free' | 'plus' | 'pro';
export type GrantResult = { status: 'granted' | 'duplicate' | 'unknown-product'; user?: UserRow };

/** purchases 행을 먼저 넣어 지급권 선점. true = 이번 호출이 지급해야 함, false = 이미 지급됨 */
async function claim(db: Db, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await db.from('purchases').insert(row);
  if (!error) return true;
  if (error.code === '23505') return false; // unique_violation → 이미 지급
  throw new Error(`purchase insert failed: ${error.message ?? error.code}`);
}
async function release(db: Db, id: string) { await db.from('purchases').delete().eq('id', id); }

/** 코인 가산 + 원장 — 낙관적 잠금(coins 값 비교) 실패 시 최신 값으로 재시도. patch 는 같은 update 에 함께 쓴다 */
export async function creditCoins(db: Db, uid: string, delta: number, reason: string, ref: string, patch?: (u: UserRow) => Record<string, unknown>): Promise<UserRow> {
  for (let i = 0; i < 6; i++) {
    const u = await getUser(db, uid);
    const balance = u.coins + delta;
    if (balance < 0) throw new Error('nofunds');
    const extra = patch ? patch(u) : {};
    const { data, error } = await db.from('users').update({ ...extra, coins: balance }).eq('id', uid).eq('coins', u.coins).select('id');
    if (error) throw new Error('coin update failed');
    if (Array.isArray(data) && data.length > 0) {
      await db.from('coin_ledger').insert({ user_id: uid, delta, reason, ref, balance_after: balance });
      return { ...u, ...extra, coins: balance } as UserRow;
    }
  }
  throw new Error('coin update contention');
}

/** 코인 팩(소모성) 1건 지급 */
export async function grantPack(db: Db, uid: string, productId: string, txn: string, raw: unknown): Promise<GrantResult> {
  const pk = RULES.PACKS[productId];
  if (!pk) return { status: 'unknown-product' };
  if (!(await claim(db, { id: txn, user_id: uid, product_id: productId, kind: 'pack', krw: pk.krw, coins: pk.coins, raw }))) return { status: 'duplicate' };
  try {
    return { status: 'granted', user: await creditCoins(db, uid, pk.coins, 'pack', txn) };
  } catch (e) { await release(db, txn); throw e; }
}

/** 구독 한 기간(최초 결제·갱신) 지급 — 매월 코인 + 방어권/UFO/위성 + plan 설정 */
export async function grantPlanPeriod(db: Db, uid: string, productId: string, txn: string, expiresAt: string | null, raw: unknown): Promise<GrantResult> {
  const g = RULES.PLAN_GRANTS[productId];
  if (!g) return { status: 'unknown-product' };
  if (!(await claim(db, { id: txn, user_id: uid, product_id: productId, kind: 'plan', krw: g.plan === 'pro' ? 12900 : 4900, coins: g.coins, raw }))) return { status: 'duplicate' };
  try {
    const user = await creditCoins(db, uid, g.coins, 'plan_monthly', txn, (u) => ({
      plan: g.plan, plan_expires_at: expiresAt,
      inventory: { ...u.inventory, shield: (u.inventory?.shield ?? 0) + g.shield, ufo: (u.inventory?.ufo ?? 0) + g.ufo, orbit: (u.inventory?.orbit ?? 0) + g.orbit },
    }));
    return { status: 'granted', user };
  } catch (e) { await release(db, txn); throw e; }
}

/** 스토어 상품 id 정규화 — Google 구독은 RevenueCat 에서 "productId:basePlanId" 로 온다 */
export const baseProductId = (id: string) => id.split(':')[0];

export const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2 };
