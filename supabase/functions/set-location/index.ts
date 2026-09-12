// @ts-nocheck
// 위치 수집: 분당 1회 초과는 무시 · geohash6/4 저장 · 정확 좌표는 서버만 읽는다
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, fail, geohash, json } from '../_shared/core.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { lat, lng, city, country, tz } = await req.json();
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('coords');
  const { data: prev } = await db.from('users_private').select('location_updated_at').eq('user_id', uid).single();
  if (prev?.location_updated_at && Date.now() - new Date(prev.location_updated_at).getTime() < RULES.LOCATION_MIN_INTERVAL_MS) return json({ ok: true, skipped: true });
  const p = { lat, lng };
  await db.from('users_private').upsert({ user_id: uid, lat, lng, geohash6: geohash(p, 6), geohash4: geohash(p, 4), location_updated_at: new Date().toISOString(), ...(tz ? { tz } : {}) });
  if (city) await db.from('users').update({ city, country: country ?? '', last_active_at: new Date().toISOString() }).eq('id', uid);
  return json({ ok: true });
});
