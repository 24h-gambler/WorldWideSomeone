// @ts-nocheck
// RevenueCat 웹훅 — 서명(Authorization 헤더 비밀) 검증 · 코인 팩/플랜 지급 · 원장 기록
// 지급 로직은 _shared/grant.ts (rc-grant 와 공유). 멱등 키 = 스토어 트랜잭션 id → 앱 경로(rc-grant)와 겹쳐도 한 번만 지급.
import { admin } from '../_shared/deno.ts';
import { RULES, fail, json } from '../_shared/core.ts';
import { baseProductId, grantPack, grantPlanPeriod } from '../_shared/grant.ts';
Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || (req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) return fail('forbidden', 403);
  const { event } = await req.json();
  const uid = event?.app_user_id; const pid = event?.product_id ? baseProductId(event.product_id) : undefined; const txn = event?.transaction_id ?? event?.id;
  if (!uid || !pid || !txn) return fail('event');
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return json({ ok: true, skipped: 'anonymous' }); // $RCAnonymousID 등 — 앱은 항상 Supabase uid 로 로그인
  const db = admin();
  if (['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'PRODUCT_CHANGE'].includes(event.type)) {
    const r = RULES.PACKS[pid]
      ? await grantPack(db, uid, pid, txn, event)
      : await grantPlanPeriod(db, uid, pid, txn, event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null, event);
    return json({ ok: true, status: r.status });
  }
  if (event.type === 'EXPIRATION') {
    // 만료된 상품의 플랜이 지금 플랜일 때만 내린다 (플러스 → 프로 전환 후 플러스 만료로 프로가 풀리지 않게)
    const g = RULES.PLAN_GRANTS[pid];
    const { data: u } = await db.from('users').select('plan').eq('id', uid).maybeSingle();
    if (!g || u?.plan === g.plan) await db.from('users').update({ plan: 'free', plan_expires_at: null }).eq('id', uid);
  }
  return json({ ok: true });
});
