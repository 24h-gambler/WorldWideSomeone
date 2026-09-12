// @ts-nocheck
// 엿보기 · 끌어오기 · 경로 바꾸기 · 달팽이 · 침수 · 우주 — 한도·방어권·면역 검증은 서버가 한다
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, earn, fail, getUser, json, notify } from '../_shared/core.ts';
import { OCEAN_SINK_MS, PLAN_LIMITS, VEHICLES, applySnail, pullTo, rerouteThrough } from '../_shared/sim.ts';

Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { letterId, action, waypoints = [] } = await req.json();
  if (!['peek', 'pull', 'reroute', 'snail', 'sunk', 'space'].includes(action)) return fail('action');
  const { data: pb } = await db.from('passbys').select('*').eq('user_id', uid).eq('letter_id', letterId).is('resolved', null).single();
  if (!pb || new Date(pb.expires_at).getTime() < Date.now()) return fail('no_active_passby');
  const { data: l } = await db.from('letters').select('*').eq('id', letterId).single();
  if (!l) return fail('letter');
  if (l.status !== 'flying') return json({ outcome: 'gone' });
  const me = await getUser(db, uid); const v = VEHICLES[l.vehicle]; const now = Date.now(); const limits = PLAN_LIMITS[me.plan];
  const today = new Date().toISOString().slice(0, 10);
  let quota = me.quota.date === today ? { ...me.quota } : { ...me.quota, date: today, peeks: 0, pulls: 0, earned: 0 };
  let inventory = { ...me.inventory };
  const flight = { ...l, departedAt: new Date(l.departed_at).getTime(), arrivesAt: new Date(l.arrives_at).getTime(), penalty: l.penalty };
  const resolve = (r: string) => db.from('passbys').update({ resolved: r }).eq('id', pb.id);
  const defended = async () => { await db.from('letters').update({ shield: false, events: [...l.events, { type: 'defended', at: now, by: uid, place: me.city }] }).eq('id', letterId); await resolve('defended'); await notify(db, l.sender_id, 'defended', '🛡️ 방어권이 장난을 막았어요', `${me.city}에서 누군가 편지를 건드렸지만 튕겨냈어요`, `/letter/${letterId}`, 4); return json({ outcome: 'defended' }); };

  if (action === 'peek') {
    if (l.vehicle === 'submarine' || l.vehicle === 'carpet') return json({ outcome: 'immune' });
    if (pb.peeked) return json({ outcome: 'done', text: l.text });
    if (quota.peeks < limits.dailyPeeks) quota.peeks += 1; else if (inventory.peek > 0) inventory.peek -= 1; else return json({ outcome: 'quota' });
    await db.from('users').update({ quota, inventory }).eq('id', uid);
    await db.from('passbys').update({ peeked: true }).eq('id', pb.id);
    await db.from('letters').update({ peeked_by: [...new Set([...l.peeked_by, uid])], events: [...l.events, { type: 'peeked', at: now, by: uid, place: me.city }] }).eq('id', letterId);
    return json({ outcome: 'done', text: l.text });
  }
  if (v.immune || (action === 'sunk' && v.immuneOcean) || (action === 'snail' && v.immuneSnail)) { await resolve('defended'); return json({ outcome: 'immune' }); }
  if (action === 'pull') {
    if (l.pulls > 0) return json({ outcome: 'limit' });
    if (quota.pulls < limits.dailyPulls) quota.pulls += 1; else if (inventory.pull > 0) inventory.pull -= 1; else return json({ outcome: 'quota' });
    await db.from('users').update({ quota, inventory }).eq('id', uid);
    if (l.shield) return defended();
    const { data: priv } = await db.from('users_private').select('lat,lng').eq('user_id', uid).single();
    const target = { lat: priv.lat + (Math.random() - 0.5) * 0.09, lng: priv.lng + (Math.random() - 0.5) * 0.12 }; // 10km 오차
    const patch = pullTo(flight, now, target, RULES.TIME_SCALE);
    await db.from('letters').update({ destination: { ...target, city: me.city, country: me.country }, waypoints: patch.waypoints ?? [], departed_at: new Date(patch.departedAt).toISOString(), arrives_at: new Date(patch.arrivesAt).toISOString(), distance_km: patch.distanceKm ?? l.distance_km, pulls: 1, pulled_by: uid, target: {}, events: [...l.events, { type: 'pulled', at: now, by: uid, place: me.city }] }).eq('id', letterId);
    await resolve('pulled');
    await notify(db, l.sender_id, 'mischief', '🧲 누군가 내 편지를 끌어갔어요', '방어권이 있으면 막을 수 있어요', `/letter/${letterId}`, 4);
    return json({ outcome: 'done' });
  }
  if (l.shield) return defended();
  let patch: any = {}; let ev = action;
  if (action === 'reroute') { const wps = waypoints.slice(0, limits.maxWaypoints); if (!wps.length) return fail('waypoints'); const p = rerouteThrough(flight, now, wps, RULES.TIME_SCALE); patch = { waypoints: p.waypoints, departed_at: new Date(p.departedAt).toISOString(), arrives_at: new Date(p.arrivesAt).toISOString(), distance_km: p.distanceKm, redirects: l.redirects + 1 }; ev = 'rerouted'; }
  else if (action === 'snail') { const p = applySnail(flight, now); patch = { penalty: p.penalty, arrives_at: new Date(p.arrivesAt).toISOString() }; }
  else if (action === 'sunk') { const base = l.vehicle === 'camel' || l.vehicle === 'sail' ? OCEAN_SINK_MS / 3 : OCEAN_SINK_MS; patch = { status: 'sunk', sunk_at: new Date(now).toISOString(), sunk_until: new Date(now + base).toISOString() }; }
  else patch = { status: 'space' };
  const { error } = await db.from('letters').update({ ...patch, events: [...l.events, { type: ev, at: now, by: uid, place: me.city }] }).eq('id', letterId).eq('status', 'flying');
  if (error) return fail('race', 409);
  await resolve(ev === 'rerouted' ? 'rerouted' : action);
  await earn(db, me, RULES.COIN_REWARDS.mischief, 'mischief', letterId);
  const msg = { rerouted: '🧭 누군가 내 편지의 경로를 바꿨어요', snail: '🐌 내 편지에 달팽이가 붙었어요', sunk: '🌊 내 편지가 침수됐어요', space: '🚀 내 편지가 우주로 날아갔어요' }[ev];
  await notify(db, l.sender_id, ev === 'sunk' ? 'sunk' : 'mischief', msg, ev === 'sunk' ? `몇 시간 뒤 떠오르거나 지금 ${RULES.OCEAN_RESCUE_COINS} SC로 건져낼 수 있어요` : '방어권을 장착하면 막을 수 있어요', `/letter/${letterId}`, 4);
  return json({ outcome: 'done' });
});
