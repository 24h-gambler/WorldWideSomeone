// @ts-nocheck
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, earn, fail, getUser, json, notify } from '../_shared/core.ts';

Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { letterId } = await req.json();
  const { data: pb } = await db.from('passbys').select('*').eq('user_id', uid).eq('letter_id', letterId).is('resolved', null).single();
  if (!pb || new Date(pb.expires_at).getTime() < Date.now() || !pb.can_catch) return fail('no_active_passby');
  const { data: l } = await db.from('letters').select('*').eq('id', letterId).single();
  if (!l || !['flying', 'landed'].includes(l.status)) return fail('not_catchable');
  const me = await getUser(db, uid); const now = Date.now();
  const { error } = await db.from('letters').update({ status: 'caught', caught_by: uid, caught_at: new Date(now).toISOString(), catch_place: me.city, participants: [...new Set([...l.participants, uid])], events: [...l.events, { type: 'caught', at: now, by: uid, place: me.city }] }).eq('id', letterId).in('status', ['flying', 'landed']);
  if (error) return fail('race', 409);
  await db.from('passbys').update({ resolved: 'caught' }).eq('id', pb.id);
  const stamps = me.stamps.includes(l.stamp) ? me.stamps : [...me.stamps, l.stamp];
  const u = await earn(db, me, RULES.COIN_REWARDS.catch, 'catch', letterId);
  await db.from('users').update({ stamps, stats: { ...u.stats, caught: (u.stats.caught ?? 0) + 1, received: (u.stats.received ?? 0) + 1 }, revealed_ids: [...new Set([...u.revealed_ids, l.sender_id])] }).eq('id', uid);
  // 보낸 사람: 잡힘 보상 + 알림 (잡은 사람은 ??? 로)
  const sender = await getUser(db, l.sender_id);
  await earn(db, sender, RULES.COIN_REWARDS.caughtByOther, 'caught_by_other', letterId);
  await notify(db, l.sender_id, 'caught', `🎉 ${me.city}에서 누군가 내 편지를 잡았어요`, '답장이 오면 프로필을 보고 수락해보세요', `/letter/${letterId}`, 4);
  return json({ ok: true });
});
