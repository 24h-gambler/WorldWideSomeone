// @ts-nocheck
// 도착한 답장 수락 → 친구 + 채팅방. 왕복(편지 → 답장)이 끝난 편지만.
import { admin, caller, cors } from '../_shared/deno.ts';
import { fail, getUser, json, makeFriends, notify } from '../_shared/core.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { letterId, accept } = await req.json();
  const { data: r } = await db.from('letters').select('*').eq('id', letterId).eq('recipient_id', uid).single();
  if (!r || r.kind !== 'reply' || r.status !== 'delivered') return fail('not_pending');
  const now = Date.now();
  if (accept === false) { await db.from('letters').update({ status: 'declined', events: [...r.events, { type: 'declined', at: now, by: uid }] }).eq('id', letterId); return json({ ok: true, friends: false }); }
  const { error } = await db.from('letters').update({ status: 'approved', events: [...r.events, { type: 'approved', at: now, by: uid }] }).eq('id', letterId).eq('status', 'delivered');
  if (error) return fail('race', 409);
  const me = await getUser(db, uid);
  const { granted } = await makeFriends(db, me, r.sender_id);
  await notify(db, r.sender_id, 'approved', `🤝 ${me.nickname} 님과 친구가 됐어요`, '왕복 완료 · 실시간 채팅이 열렸어요', `/chat/${uid}`, 3);
  return json({ ok: true, friends: true, granted });
});
