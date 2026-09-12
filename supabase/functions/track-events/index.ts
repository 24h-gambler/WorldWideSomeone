// @ts-nocheck
// 트래킹 배치 수신 — 비회원 포함. 기기당 분당 600건 초과분은 버린다.
import { admin, cors } from '../_shared/deno.ts';
import { fail, json } from '../_shared/core.ts';
const buckets = new Map<string, { n: number; at: number }>();
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const { events } = await req.json();
  if (!Array.isArray(events) || events.length > 200) return fail('events');
  const now = Date.now();
  const rows = events.filter((e) => e && typeof e.name === 'string' && typeof e.device === 'string').filter((e) => { const b = buckets.get(e.device) ?? { n: 0, at: now }; if (now - b.at > 60_000) { b.n = 0; b.at = now; } b.n += 1; buckets.set(e.device, b); return b.n <= 600; })
    .map((e) => ({ device: e.device.slice(0, 64), user_id: e.user && /^[0-9a-f-]{36}$/.test(e.user) ? e.user : null, guest: !!e.guest, session: String(e.session).slice(0, 40), name: e.name.slice(0, 64), screen: e.screen?.slice(0, 120) ?? null, props: e.props ?? null, at: new Date(e.at ?? now).toISOString() }));
  if (rows.length) { const { error } = await admin().from('events').insert(rows); if (error) return fail(error.message, 500); }
  return json({ ok: true, accepted: rows.length });
});
