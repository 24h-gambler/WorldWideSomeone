/**
 * WWS 4시간 자동화 오케스트레이터 — BE + FE + LiveLike + 코드검정 + 디자인 한번에.
 *   node scripts/run-4h.mjs [--full] [--skip-typecheck] [--skip-livelike] [--skip-design] [--json]
 * --full 이면 LiveLike 32단계 + visual 회귀 포함, 기본은 스모크 6단계 (4시간 cadence용).
 * 각 단계 결과는 reports/4h-<ts>.json 에 저장. 실패 시 exit 1.
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const FULL = args.includes('--full') || process.env.FULL === '1';
const SKIP_TC = args.includes('--skip-typecheck');
const SKIP_LIVE = args.includes('--skip-livelike') || process.env.SKIP_LIVELIKE === '1';
const SKIP_DESIGN = args.includes('--skip-design') || process.env.SKIP_DESIGN === '1';
const JSON_MODE = args.includes('--json');
const log = (...a) => { if (!JSON_MODE) console.log(...a); };
fs.mkdirSync('reports', { recursive: true });

const run = (cmd, argv, opts = {}) => new Promise((resolve) => {
  const t0 = Date.now();
  const c = spawn(cmd, argv, { ...opts });
  let out = '';
  c.stdout?.on('data', (d) => { out += d; if (!JSON_MODE) process.stdout.write(d); });
  c.stderr?.on('data', (d) => { out += d; if (!JSON_MODE) process.stderr.write(d); });
  c.on('close', (code) => resolve({ code: code ?? 1, ms: Date.now() - t0, out: out.slice(-2000) }));
  c.on('error', (e) => resolve({ code: 1, ms: Date.now() - t0, out: String(e.message) }));
});

const stages = [];
const stage = async (id, title, fn, { allowFail = false } = {}) => {
  log(`\n━━ ${id} ${title} ━━`);
  const t0 = Date.now();
  try {
    const r = await fn();
    const ok = r.code === 0;
    stages.push({ id, title, ok: ok || allowFail, skipped: false, ms: Date.now() - t0, code: r.code });
    log(`${ok ? '✅' : '❌'} ${id} ${title} (${Date.now() - t0}ms)`);
    return ok;
  } catch (e) {
    stages.push({ id, title, ok: false, skipped: false, ms: Date.now() - t0, error: String(e.message).slice(0, 200) });
    log(`❌ ${id} ${title} — ${String(e.message).slice(0, 150)}`);
    return false;
  }
};

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NODE = process.execPath;

// 1. 타입체크 (앱)
if (!SKIP_TC) await stage('T1', '타입체크 앱 (tsc --noEmit)', () => run(NPM, ['run', 'typecheck']));
else { stages.push({ id: 'T1', title: '타입체크 앱', ok: true, skipped: true, ms: 0 }); log('⏭️ T1 skipped'); }

// 2. 타입체크 (Edge Functions)
if (!SKIP_TC) await stage('T2', '타입체크 functions', () => run(NPM, ['run', 'typecheck:functions']));
else { stages.push({ id: 'T2', title: '타입체크 functions', ok: true, skipped: true, ms: 0 }); log('⏭️ T2 skipped'); }

// 3. 코드 검정 (FE 제품규칙 + 상수일치)
await stage('C', '코드 검정 (제품규칙 12항)', () => run(NODE, ['scripts/code-check.mjs']));

// 4. 백엔드 생존 (BE) — secrets 없으면 SKIPPED扱いで 통과
await stage('BE', '백엔드 생존 (Supabase+13 functions)', () => run(NODE, ['scripts/backend-check.mjs']));

// 4b. 크로스 repo 접근 (3앱 병렬 관문) — 토큰 없으면 SKIPPED
await stage('X', '크로스 repo 접근 (BEFF·LiveLike)', () => run(NODE, ['scripts/cross-repo-check.mjs']));

// 5. LiveLike 실앱 진입
if (!SKIP_LIVE) {
  const mode = FULL ? '--full' : '--smoke';
  await stage('LIVE', `LiveLike 실앱 (${FULL ? '32단계 full' : '스모크 6단계'})`, () => run(NODE, ['scripts/livelike-check.mjs', mode]));
} else { stages.push({ id: 'LIVE', title: 'LiveLike 실앱', ok: true, skipped: true, ms: 0 }); log('⏭️ LIVE skipped'); }

// 6. 디자인 정적 검정 (D1–D5, 자동수정/제안 분류)
if (!SKIP_DESIGN) {
  await stage('D', '디자인 정적 검정 (D1–D5)', () => run(NODE, ['scripts/design-check.mjs']));
} else { stages.push({ id: 'D', title: '디자인 정적 검정', ok: true, skipped: true, ms: 0 }); log('⏭️ D skipped'); }

// 7. 비주얼 회귀 + 깨짐 탐지 (full에서만, BASE 없으면 SKIPPED)
if (!SKIP_DESIGN && FULL) {
  await stage('V', '비주얼 회귀 + 깨짐 탐지', () => run(NODE, ['scripts/visual-check.mjs']));
} else { stages.push({ id: 'V', title: '비주얼 회귀 + 깨짐 탐지', ok: true, skipped: true, ms: 0 }); log('⏭️ V skipped (full 전용)'); }

const failed = stages.filter((s) => !s.ok);
const report = { at: new Date().toISOString(), full: FULL, ok: !failed.length, stages };
const fname = `reports/4h-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
fs.writeFileSync(fname, JSON.stringify(report, null, 2));
fs.writeFileSync('reports/4h-latest.json', JSON.stringify(report, null, 2));

if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
else {
  log(`\n${'═'.repeat(40)}\n4H 결과: ${stages.filter((s) => s.ok).length}/${stages.length} 통과 → ${fname}`);
  if (failed.length) log('실패: ' + failed.map((f) => f.id).join(', '));
}
process.exit(failed.length ? 1 : 0);
