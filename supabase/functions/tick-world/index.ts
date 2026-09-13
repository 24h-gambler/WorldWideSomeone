// @ts-nocheck
// 매 분: 재부상 · 도착/착륙/만료 · 셀 예측 · 통과 판정(셀 조인 + 핫셀 샘플 + 편지당 상한) · 알림 큐. 25초 예산, 커서로 이어서.
import { admin, cors, isCron } from '../_shared/deno.ts';
import { RULES, cells4, fail, geohash, getUser, json, matchesTarget, notify, earn } from '../_shared/core.ts';
import { LANDED_WINDOW_MS, PASSBY_RADIUS_KM, VEHICLES, catchWindowMs, minDistanceBetween, resurface, upcomingPoints } from '../_shared/sim.ts';
import { distanceKm } from '../_shared/geo.ts';

Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  if (!isCron(req)) return fail('forbidden', 403);
  const db = admin(); const started = Date.now(); const now = Date.now(); const budget = () => Date.now() - started < 25_000;
  const nowIso = new Date(now).toISOString();
  let stats = { resurfaced: 0, arrived: 0, expired: 0, passbys: 0, letters: 0 };

  // 1) 재부상
  const { data: sunk } = await db.from('letters').select('*').eq('status', 'sunk').lte('sunk_until', nowIso).limit(500);
  for (const l of sunk ?? []) { const p = resurface({ ...l, departedAt: new Date(l.departed_at).getTime(), arrivesAt: new Date(l.arrives_at).getTime(), sunkAt: new Date(l.sunk_at).getTime() }, now); await db.from('letters').update({ status: 'flying', sunk_at: null, sunk_until: null, departed_at: new Date(p.departedAt).toISOString(), arrives_at: new Date(p.arrivesAt).toISOString(), events: [...l.events, { type: 'resurfaced', at: now }] }).eq('id', l.id).eq('status', 'sunk'); await notify(db, l.sender_id, 'sunk', '🌊 편지가 다시 떠올랐어요', '이어서 목적지로 갑니다', `/letter/${l.id}`, 5); stats.resurfaced++; }

  // 2) 도착
  const { data: arriving } = await db.from('letters').select('*').eq('status', 'flying').lte('arrives_at', nowIso).limit(1000);
  for (const l of arriving ?? []) {
    if (!budget()) break;
    if (l.recipient_id) {
      const { error } = await db.from('letters').update({ status: 'delivered', landed_at: nowIso, events: [...l.events, { type: 'delivered', at: now, place: l.destination.city }] }).eq('id', l.id).eq('status', 'flying');
      if (error) continue;
      const r = await getUser(db, l.recipient_id);
      await earn(db, r, RULES.COIN_REWARDS.received, 'received', l.id);
      await db.from('users').update({ stats: { ...r.stats, received: (r.stats.received ?? 0) + 1 }, revealed_ids: [...new Set([...r.revealed_ids, l.sender_id])] }).eq('id', l.recipient_id);
      const isReply = l.kind === 'reply';
      await notify(db, l.recipient_id, isReply ? 'reply' : 'direct', isReply ? '📬 답장이 도착했어요' : '📬 직행 편지가 도착했어요', isReply ? '수락하면 친구가 되고 실시간 채팅이 열려요' : '읽고 답장해보세요', `/letter/${l.id}`, 3);
    } else {
      const { error } = await db.from('letters').update({ status: 'landed', landed_at: nowIso, events: [...l.events, { type: 'landed', at: now, place: l.destination.city }] }).eq('id', l.id).eq('status', 'flying');
      if (error) continue;
      await notify(db, l.sender_id, 'landed', `📍 ${l.destination.city}에 착륙`, '누군가 집어갈 때까지 기다려요', `/letter/${l.id}`, 6);
      // 근처(150km) 사용자에게 착륙 통과 (착륙 편지는 지구에 보이지 않지만 근처 사람은 집을 수 있다)
      const cell = geohash(l.destination, 4);
      const { data: near } = await db.from('users_private').select('user_id,lat,lng').eq('geohash4', cell).limit(RULES.HOT_CELL_SAMPLE);
      for (const u of near ?? []) { if (u.user_id === l.sender_id) continue; if (distanceKm({ lat: u.lat, lng: u.lng }, l.destination) > PASSBY_RADIUS_KM) continue; const me = await getUser(db, u.user_id); const canCatch = l.pulled_by === u.user_id || matchesTarget(me, l.target); await db.from('passbys').upsert({ user_id: u.user_id, letter_id: l.id, at: nowIso, expires_at: new Date(now + LANDED_WINDOW_MS).toISOString(), can_catch: canCatch }, { onConflict: 'user_id,letter_id', ignoreDuplicates: true }); await notify(db, u.user_id, 'passby', l.pulled_by === u.user_id ? '🧲 끌어온 편지가 도착했어요' : '📍 근처에 편지가 착륙했어요', `${l.origin.city}에서 온 ${VEHICLES[l.vehicle] ? l.vehicle : '편지'}`, `/catch/${l.id}`, 5); }
    }
    stats.arrived++;
  }
  // 3) 착륙 만료
  const { data: stale } = await db.from('letters').select('id,events,sender_id,landed_at').eq('status', 'landed').lte('landed_at', new Date(now - LANDED_WINDOW_MS).toISOString()).limit(500);
  for (const l of stale ?? []) { await db.from('letters').update({ status: 'expired', events: [...l.events, { type: 'expired', at: now }] }).eq('id', l.id).eq('status', 'landed'); stats.expired++; }

  // 4) 통과 판정 — 비행 중이고 수신자 없는 편지 × 같은 셀 사용자
  const { data: flying } = await db.from('letters').select('*').eq('status', 'flying').is('recipient_id', null).order('arrives_at').limit(3000);
  const prev = now - 60_000;
  for (const l of flying ?? []) {
    if (!budget()) break;
    stats.letters++;
    const flight = { ...l, departedAt: new Date(l.departed_at).getTime(), arrivesAt: new Date(l.arrives_at).getTime(), penalty: l.penalty };
    const nextCells = cells4(upcomingPoints(flight, now, 90_000));
    const cellsNow = [...new Set([...(l.cells4 ?? []), ...nextCells])];
    if (JSON.stringify(nextCells) !== JSON.stringify(l.cells4)) await db.from('letters').update({ cells4: nextCells }).eq('id', l.id);
    const { data: cand, count } = await db.from('users_private').select('user_id,lat,lng', { count: 'exact' }).in('geohash4', cellsNow).limit(RULES.HOT_CELL_USERS);
    let users = cand ?? [];
    if ((count ?? 0) > RULES.HOT_CELL_USERS) users = users.sort(() => Math.random() - 0.5).slice(0, RULES.HOT_CELL_SAMPLE); // 핫셀 샘플링
    let made = 0;
    // 정밀 판정 → 후보만 모아 사용자 행을 한 번에 조회 (N+1 제거)
    const hits = users.filter((u) => u.user_id !== l.sender_id && u.lat && minDistanceBetween(flight, prev, now, { lat: u.lat, lng: u.lng }) <= PASSBY_RADIUS_KM).slice(0, RULES.PASSBY_PER_LETTER_PER_TICK);
    const { data: hitUsers } = hits.length ? await db.from('users').select('*').in('id', hits.map((h) => h.user_id)) : { data: [] };
    const U = new Map((hitUsers ?? []).map((x) => [x.id, x]));
    for (const u of hits) {
      const { data: ins, error } = await db.from('passbys').insert({ user_id: u.user_id, letter_id: l.id, at: nowIso, expires_at: new Date(Math.max(now + 15_000, Math.min(now + catchWindowMs(l.vehicle), flight.arrivesAt))).toISOString(), can_catch: true }).select('id').single();
      if (error || !ins) continue; // unique → 이미 통과한 사람
      const me = U.get(u.user_id); if (!me) continue;
      const canCatch = matchesTarget(me, l.target);
      if (!canCatch) await db.from('passbys').update({ can_catch: false }).eq('id', ins.id);
      const vname = l.vehicle;
      await notify(db, u.user_id, 'passby', `${vname}이(가) 머리 위를 지나가요!`, canCatch ? `${l.origin.city}에서 출발한 편지. 잡거나, 엿보거나, 끌어오세요` : '조건이 맞는 사람만 잡을 수 있어요 (엿보기·경로 변경은 가능)', `/catch/${l.id}`, 5);
      made++; stats.passbys++;
    }
  }
  // 5) 통과 창 만료
  await db.from('passbys').update({ resolved: 'missed' }).is('resolved', null).lte('expires_at', nowIso);
  return json({ ok: true, ms: Date.now() - started, ...stats });
});
