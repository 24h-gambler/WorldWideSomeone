// @ts-nocheck
// RevenueCat 웹훅 — 서명(Authorization 헤더 비밀) 검증 · 트랜잭션 id 로 중복 지급 방지 · 코인 팩/플랜 지급 · 원장 기록
import { admin } from '../_shared/deno.ts';
import { RULES, coinDelta, fail, getUser, json } from '../_shared/core.ts';
Deno.serve(async (req) => {
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_SECRET')}`) return fail('forbidden', 403);
  const { event } = await req.json();
  const uid = event?.app_user_id; const pid = event?.product_id; const txn = event?.transaction_id ?? event?.id;
  if (!uid || !pid || !txn) return fail('event');
  const db = admin();
  const { data: dup } = await db.from('purchases').select('id').eq('id', txn).maybeSingle();
  if (dup) return json({ ok: true, duplicate: true });
  if (['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'PRODUCT_CHANGE'].includes(event.type)) {
    const me = await getUser(db, uid);
    if (RULES.PACKS[pid]) {
      const pk = RULES.PACKS[pid];
      await db.from('purchases').insert({ id: txn, user_id: uid, product_id: pid, kind: 'pack', krw: pk.krw, coins: pk.coins, raw: event });
      await coinDelta(db, me, pk.coins, 'pack', txn);
    } else if (RULES.PLAN_GRANTS[pid]) {
      const g = RULES.PLAN_GRANTS[pid];
      await db.from('purchases').insert({ id: txn, user_id: uid, product_id: pid, kind: 'plan', krw: g.plan === 'pro' ? 12900 : 4900, coins: g.coins, raw: event });
      await db.from('users').update({ plan: g.plan, plan_expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null, inventory: { ...me.inventory, shield: (me.inventory.shield ?? 0) + g.shield, ufo: (me.inventory.ufo ?? 0) + g.ufo, orbit: (me.inventory.orbit ?? 0) + g.orbit } }).eq('id', uid);
      await coinDelta(db, me, g.coins, 'plan_monthly', txn);
    }
  } else if (['EXPIRATION', 'CANCELLATION'].includes(event.type) && event.type === 'EXPIRATION') {
    await db.from('users').update({ plan: 'free', plan_expires_at: null }).eq('id', uid);
  }
  return json({ ok: true });
});
