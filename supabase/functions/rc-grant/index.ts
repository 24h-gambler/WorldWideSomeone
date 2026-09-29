// @ts-nocheck
// 앱 → 서버 결제 확정 (구매 직후 · 복원 · 앱 시작 시). RevenueCat REST(v1 subscribers)를 서버 비밀키로 조회해서
//   - 코인 팩(non_subscriptions): 스토어 트랜잭션마다 정확히 한 번 지급
//   - 구독(subscriptions): 현재 기간 트랜잭션마다 매월 코인·아이템 한 번 지급
//   - 엔타이틀먼트(plus/pro): users.plan / plan_expires_at 을 RevenueCat 기준으로 맞춤 (pro > plus > free)
// 지급 로직·멱등 키(purchases.id = 스토어 트랜잭션 id)는 purchase-webhook 과 공유(_shared/grant.ts) → 두 경로가 겹쳐도 중복 지급 없음.
// 응답: { coins, plan, planExpiresAt(ms|null), inventory, granted: [{ productId, txn, coins }], pending }
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, fail, getUser, json } from '../_shared/core.ts';
import { PLAN_RANK, baseProductId, grantPack, grantPlanPeriod } from '../_shared/grant.ts';

const ms = (s?: string | null) => (s ? Date.parse(s) : NaN);
/** 만료가 없거나(평생) 만료/유예 기간이 아직 남았으면 활성 */
const activeUntil = (e: { expires_date?: string | null; grace_period_expires_date?: string | null }, now: number): number | null | false => {
  if (!e.expires_date) return null; // 만료 없음
  const until = Math.max(ms(e.expires_date) || 0, ms(e.grace_period_expires_date) || 0);
  return until > now ? until : false;
};

Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const key = Deno.env.get('RC_SECRET_KEY');
  if (!key) return fail('payments-not-configured', 503);

  const db = admin();
  try { await getUser(db, uid); } catch { return fail('no-profile', 404); } // users 행(pushProfile) 이 먼저 있어야 지급 가능
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if (!res.ok) return fail('revenuecat-unavailable', 502);
  const sub = (await res.json())?.subscriber ?? {};
  const now = Date.now();
  const granted: { productId: string; txn: string; coins: number }[] = [];
  let pending = 0;

  // 1) 코인 팩 — 소모성 트랜잭션 전부 (환불 건 제외)
  for (const [rawPid, txs] of Object.entries(sub.non_subscriptions ?? {})) {
    const pid = baseProductId(rawPid);
    if (!RULES.PACKS[pid]) continue;
    for (const tx of (txs as any[]) ?? []) {
      if (tx?.refunded_at) continue;
      const txn = tx?.store_transaction_id ?? tx?.id;
      if (!txn) continue;
      try {
        const r = await grantPack(db, uid, pid, String(txn), { source: 'rc-grant', product_id: rawPid, ...tx });
        if (r.status === 'granted') granted.push({ productId: pid, txn: String(txn), coins: RULES.PACKS[pid].coins });
      } catch { pending++; }
    }
  }

  // 2) 구독 — 활성 기간의 트랜잭션마다 매월 지급 (웹훅 RENEWAL 과 같은 키)
  let subPlan: 'free' | 'plus' | 'pro' = 'free'; let subExp: number | null = null;
  for (const [rawPid, s] of Object.entries(sub.subscriptions ?? {}) as [string, any][]) {
    const pid = baseProductId(rawPid); const g = RULES.PLAN_GRANTS[pid];
    if (!g || s?.refunded_at) continue;
    const until = activeUntil(s, now);
    if (until === false) continue;
    if (PLAN_RANK[g.plan] > PLAN_RANK[subPlan]) { subPlan = g.plan; subExp = until; }
    const txn = s?.store_transaction_id;
    if (!txn) continue;
    try {
      const r = await grantPlanPeriod(db, uid, pid, String(txn), s.expires_date ?? null, { source: 'rc-grant', product_id: rawPid, ...s });
      if (r.status === 'granted') granted.push({ productId: pid, txn: String(txn), coins: g.coins });
    } catch { pending++; }
  }

  // 3) 엔타이틀먼트 → plan (구독 목록과 교차 확인, 높은 쪽)
  let plan: 'free' | 'plus' | 'pro' = subPlan; let planExp: number | null = subExp;
  for (const id of ['pro', 'plus'] as const) {
    const e = sub.entitlements?.[id];
    if (!e) continue;
    const until = activeUntil(e, now);
    if (until === false) continue;
    if (PLAN_RANK[id] > PLAN_RANK[plan]) { plan = id; planExp = until; }
  }

  let me = await getUser(db, uid);
  const expIso = planExp ? new Date(planExp).toISOString() : null;
  const curExp = (me as any).plan_expires_at ? Date.parse((me as any).plan_expires_at) : null;
  if (me.plan !== plan || (plan !== 'free' && curExp !== planExp) || (plan === 'free' && curExp !== null)) {
    await db.from('users').update({ plan, plan_expires_at: expIso }).eq('id', uid);
    me = await getUser(db, uid);
  }
  return json({ coins: me.coins, plan: me.plan, planExpiresAt: (me as any).plan_expires_at ? Date.parse((me as any).plan_expires_at) : null, inventory: me.inventory, granted, pending });
});
