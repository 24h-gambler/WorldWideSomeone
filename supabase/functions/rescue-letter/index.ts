// @ts-nocheck
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, coinDelta, fail, getUser, json } from '../_shared/core.ts';
import { resurface } from '../_shared/sim.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { letterId } = await req.json();
  const { data: l } = await db.from('letters').select('*').eq('id', letterId).eq('sender_id', uid).single();
  if (!l || l.status !== 'sunk') return fail('not_sunk');
  const me = await getUser(db, uid);
  try { await coinDelta(db, me, -RULES.OCEAN_RESCUE_COINS, 'rescue', letterId); } catch { return json({ outcome: 'nofunds' }); }
  const now = Date.now();
  const p = resurface({ ...l, departedAt: new Date(l.departed_at).getTime(), arrivesAt: new Date(l.arrives_at).getTime(), sunkAt: new Date(l.sunk_at).getTime() }, now);
  await db.from('letters').update({ status: 'flying', sunk_at: null, sunk_until: null, departed_at: new Date(p.departedAt).toISOString(), arrives_at: new Date(p.arrivesAt).toISOString(), events: [...l.events, { type: 'rescued', at: now, by: uid }] }).eq('id', letterId);
  return json({ outcome: 'done' });
});
