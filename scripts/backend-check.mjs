/**
 * WWS 백엔드 생존 확인 (BE) — Supabase + Edge Functions 13개.
 * 무의존(node fetch). 실행: node scripts/backend-check.mjs [--json]
 * Secrets 없으면 SKIPPED(로컬 시뮬)로 exit 0 — CI에서는 secrets를 넣으면 실제 검사.
 *   SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
const FUNCTIONS = [
  'tick-world', 'push-dispatch', 'send-letter', 'catch-letter', 'redirect-letter',
  'rescue-letter', 'approve-reply', 'boost-reply', 'set-location', 'track-events',
  'purchase-webhook', 'publish-post', 'register-push',
];

const URL = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const JSON_MODE = process.argv.includes('--json');
const log = (...a) => { if (!JSON_MODE) console.log(...a); };

async function timedFetch(url, opts = {}, timeoutMs = 12000) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const body = await r.text().catch(() => '');
    return { status: r.status, ms: Date.now() - t0, body: body.slice(0, 300) };
  } finally { clearTimeout(t); }
}

const checks = [];
if (!URL || !ANON) {
  const out = { at: new Date().toISOString(), status: 'skipped', reason: 'SUPABASE_URL/ANON_KEY 없음 — 로컬 시뮬 모드', checks: [] };
  if (JSON_MODE) console.log(JSON.stringify(out, null, 2));
  else console.log('⏭️ backend-check SKIPPED — secrets 없음 (로컬 봇 시뮬 모드). CI에 SUPABASE_URL/ANON_KEY를 넣으면 실제 검사.');
  process.exit(0);
}

const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };

// 1. Auth health
try {
  const r = await timedFetch(`${URL}/auth/v1/health`);
  const pass = r.status === 200;
  checks.push({ id: 'BE-auth', title: 'Supabase Auth 생존', ok: pass, detail: `HTTP ${r.status} · ${r.ms}ms` });
  log(`${pass ? '✅' : '❌'} BE-auth Auth 생존 — HTTP ${r.status} · ${r.ms}ms`);
} catch (e) { checks.push({ id: 'BE-auth', title: 'Supabase Auth 생존', ok: false, detail: String(e.message).slice(0, 150) }); log('❌ BE-auth', String(e.message).slice(0, 150)); }

// 2. REST reachability
try {
  const r = await timedFetch(`${URL}/rest/v1/`, { headers: H });
  const pass = r.status < 500; // 200/404/401 모두 "서버 살아있음"
  checks.push({ id: 'BE-rest', title: 'PostgREST 도달', ok: pass, detail: `HTTP ${r.status} · ${r.ms}ms` });
  log(`${pass ? '✅' : '❌'} BE-rest PostgREST — HTTP ${r.status} · ${r.ms}ms`);
} catch (e) { checks.push({ id: 'BE-rest', title: 'PostgREST 도달', ok: false, detail: String(e.message).slice(0, 150) }); log('❌ BE-rest', String(e.message).slice(0, 150)); }

// 3. Edge Functions — 401/400/405/200 = 배포됨, 404 = 미배포
for (const fn of FUNCTIONS) {
  try {
    const r = await timedFetch(`${URL}/functions/v1/${fn}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    const pass = r.status !== 404;
    checks.push({ id: `BE-fn:${fn}`, title: `Edge Function ${fn}`, ok: pass, detail: `HTTP ${r.status} · ${r.ms}ms` });
    log(`${pass ? '✅' : '❌'} BE-fn:${fn} — HTTP ${r.status} · ${r.ms}ms`);
  } catch (e) { checks.push({ id: `BE-fn:${fn}`, title: `Edge Function ${fn}`, ok: false, detail: String(e.message).slice(0, 150) }); log(`❌ BE-fn:${fn}`, String(e.message).slice(0, 150)); }
}

// 4. 스키마(users) 존재 — 200(읽힘) 또는 401/403(RLS로 막힘 = 스키마 있음) = 통과
try {
  const r = await timedFetch(`${URL}/rest/v1/users?select=id&limit=1`, { headers: H });
  const pass = [200, 401, 403].includes(r.status);
  checks.push({ id: 'BE-schema', title: '스키마 users 존재', ok: pass, detail: `HTTP ${r.status} · ${r.ms}ms ${pass ? '' : r.body}`.trim() });
  log(`${pass ? '✅' : '❌'} BE-schema users — HTTP ${r.status} · ${r.ms}ms`);
} catch (e) { checks.push({ id: 'BE-schema', title: '스키마 users 존재', ok: false, detail: String(e.message).slice(0, 150) }); log('❌ BE-schema', String(e.message).slice(0, 150)); }

const failed = checks.filter((c) => !c.ok);
const out = { at: new Date().toISOString(), url: URL.replace(/^https?:\/\//, '').slice(0, 20) + '…', status: failed.length ? 'fail' : 'pass', checks };
if (JSON_MODE) console.log(JSON.stringify(out, null, 2));
else console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
try { await import('node:fs').then(async ({ default: fs }) => { fs.mkdirSync('reports', { recursive: true }); }); } catch {}
try {
  const fs = (await import('node:fs')).default;
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/backend-check.json', JSON.stringify(out, null, 2));
} catch {}
process.exit(failed.length ? 1 : 0);
