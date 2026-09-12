// @ts-nocheck
// 푸시 큐 → Expo Push API. 우선순위 순 · 사용자별 통과 푸시 하루 12건 · 조용한 시간 · 30초 묶음 · 배치 100 · 죽은 토큰 정리
import { admin, cors, isCron } from '../_shared/deno.ts';
import { RULES, fail, json } from '../_shared/core.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  if (!isCron(req)) return fail('forbidden', 403);
  const db = admin();
  const { data: q } = await db.from('push_queue').select('*').is('sent_at', null).order('priority').order('created_at').limit(500);
  if (!q?.length) return json({ sent: 0 });
  const userIds = [...new Set(q.map((r) => r.user_id))];
  const { data: privs } = await db.from('users_private').select('user_id,push_token,notify_passby,notify_quiet_from,notify_quiet_to,tz,passby_pushes_today,passby_push_day').in('user_id', userIds);
  const P = new Map(privs?.map((p) => [p.user_id, p]) ?? []);
  const today = new Date().toISOString().slice(0, 10);
  const messages = []; const done = []; const counters = new Map();
  const byUser = new Map();
  for (const r of q) { const arr = byUser.get(r.user_id) ?? []; arr.push(r); byUser.set(r.user_id, arr); }
  for (const [uidKey, rows] of byUser) {
    const p = P.get(uidKey); if (!p?.push_token) { done.push(...rows.map((r) => ({ id: r.id, error: 'no_token' }))); continue; }
    const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: p.tz || 'Asia/Seoul' }));
    const quiet = p.notify_quiet_from > p.notify_quiet_to ? hour >= p.notify_quiet_from || hour < p.notify_quiet_to : hour >= p.notify_quiet_from && hour < p.notify_quiet_to;
    let passbyCount = p.passby_push_day === today ? p.passby_pushes_today : 0;
    const passbys = rows.filter((r) => r.kind === 'passby'); const others = rows.filter((r) => r.kind !== 'passby');
    for (const r of others) { messages.push({ to: p.push_token, title: r.title, body: r.body, data: { route: r.route }, priority: r.priority <= 3 ? 'high' : 'default' }); done.push({ id: r.id }); }
    if (passbys.length) {
      if (!p.notify_passby || quiet || passbyCount >= RULES.PASSBY_PUSH_DAILY_CAP) { done.push(...passbys.map((r) => ({ id: r.id, error: quiet ? 'quiet' : 'cap' }))); }
      else if (passbys.length >= 3) { messages.push({ to: p.push_token, title: `✈️ 편지 ${passbys.length}통이 머리 위를 지나가요`, body: '지금 잡거나 엿보세요', data: { route: '/' } }); done.push(...passbys.map((r) => ({ id: r.id }))); passbyCount += 1; }
      else { for (const r of passbys) { messages.push({ to: p.push_token, title: r.title, body: r.body, data: { route: r.route } }); done.push({ id: r.id }); passbyCount += 1; } }
      counters.set(uidKey, passbyCount);
    }
  }
  let sent = 0; const dead = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(chunk) });
      const out = await res.json();
      out.data?.forEach((t, k) => { if (t.status === 'ok') sent += 1; else if (t.details?.error === 'DeviceNotRegistered') dead.push(chunk[k].to); });
    } catch (e) { /* 다음 틱에 재시도되도록 sent_at 은 그대로 둔다 */ continue; }
  }
  const now = new Date().toISOString();
  for (const d of done) await db.from('push_queue').update({ sent_at: now, error: d.error ?? null }).eq('id', d.id);
  for (const [uidKey, n] of counters) await db.from('users_private').update({ passby_pushes_today: n, passby_push_day: today }).eq('user_id', uidKey);
  if (dead.length) await db.from('users_private').update({ push_token: null }).in('push_token', dead);
  return json({ sent, queued: q.length, dead: dead.length });
});
