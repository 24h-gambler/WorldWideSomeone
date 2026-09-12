// @ts-nocheck
// 오는 답장을 코인으로 가속 (받는 쪽) — fast: 남은 시간 1/4 · instant: 60초
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, coinDelta, discounted, fail, getUser, json } from '../_shared/core.ts';
import { speedUp } from '../_shared/sim.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { letterId, tier } = await req.json();
  if (!['fast', 'instant'].includes(tier)) return fail('tier');
  const { data: l } = await db.from('letters').select('*').eq('id', letterId).eq('recipient_id', uid).single();
  if (!l || l.status !== 'flying') return json({ outcome: 'gone' });
  if (l.boost === 'instant' || (l.boost === 'fast' && tier === 'fast')) return json({ outcome: 'limit' });
  const me = await getUser(db, uid);
  const price = discounted(RULES.REPLY_BOOST[tier].coins, me.plan);
  try { await coinDelta(db, me, -price, `boost_${tier}`, letterId); } catch { return json({ outcome: 'nofunds' }); }
  const now = Date.now(); const flight = { ...l, departedAt: new Date(l.departed_at).getTime(), arrivesAt: new Date(l.arrives_at).getTime(), penalty: l.penalty };
  const remaining = tier === 'instant' ? RULES.REPLY_BOOST.instant.seconds * 1000 : Math.max(5000, (flight.arrivesAt - now) / RULES.REPLY_BOOST.fast.factor);
  const p = speedUp(flight, now, remaining);
  await db.from('letters').update({ departed_at: new Date(p.departedAt).toISOString(), arrives_at: new Date(p.arrivesAt).toISOString(), penalty: null, boost: tier, events: [...l.events, { type: 'boosted', at: now, by: uid }] }).eq('id', letterId);
  return json({ outcome: 'done', price });
});
