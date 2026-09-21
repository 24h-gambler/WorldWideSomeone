/**
 * WWS LiveLike — 실제 앱에 들어가서 사용성 검사 (FE 실주행).
 *   node scripts/livelike-check.mjs [--smoke|--full|--probe] [--base URL]
 * --smoke (기본·4시간용): 환영→위치→홈→탭 4개→작성 게이트까지 6스텝 실클릭 + 콘솔에러/로딩 수집
 * --full  : scripts/screenshots.mjs 32단계 전체 위임 (nightly/수동)
 * --probe : 브라우저 없이 HTTP 200 + 핵심 문구 존재만 확인 (폴백)
 * BASE 우선순위: --base > LIVE_URL > BASE > http://localhost:8081
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const mode = args.includes('--full') ? 'full' : args.includes('--probe') ? 'probe' : 'smoke';
const baseArg = args[args.indexOf('--base') + 1];
const BASE = (baseArg && !baseArg.startsWith('--') ? baseArg : null)
  || process.env.LIVE_URL || process.env.BASE || 'http://localhost:8081';
const OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('reports', { recursive: true });

// ── full: 기존 32단계에 위임 ──
if (mode === 'full') {
  console.log(`🎬 LiveLike FULL → scripts/screenshots.mjs (BASE=${BASE})`);
  const child = spawn('node', ['scripts/screenshots.mjs'], { env: { ...process.env, BASE }, stdio: 'inherit' });
  const code = await new Promise((res) => child.on('close', res));
  try {
    const r = JSON.parse(fs.readFileSync(`${OUT}/results.json`, 'utf8'));
    const pass = r.results.filter((x) => x.ok).length;
    const summary = { at: new Date().toISOString(), mode: 'full', base: BASE, pass, total: r.results.length, errors: r.errors?.length ?? 0 };
    fs.writeFileSync('reports/livelike-check.json', JSON.stringify(summary, null, 2));
    console.log(`\nFULL: ${pass}/${r.results.length} 통과 · 콘솔오류 ${summary.errors}건`);
    process.exit(code === 0 && pass === r.results.length ? 0 : 1);
  } catch { process.exit(code ?? 1); }
}

// ── probe: HTTP만 ──
if (mode === 'probe') {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE);
    const html = await r.text();
    const ms = Date.now() - t0;
    const hasApp = /전세계|WorldWide|expo|__next|root/i.test(html);
    const summary = { at: new Date().toISOString(), mode: 'probe', base: BASE, http: r.status, ms, hasApp, ok: r.status === 200 && hasApp };
    fs.writeFileSync('reports/livelike-check.json', JSON.stringify(summary, null, 2));
    console.log(`${summary.ok ? '✅' : '❌'} PROBE ${BASE} — HTTP ${r.status} · ${ms}ms · 앱흔적 ${hasApp ? '있음' : '없음'}`);
    process.exit(summary.ok ? 0 : 1);
  } catch (e) {
    console.log(`❌ PROBE ${BASE} — 도달 불가: ${String(e.message).slice(0, 150)}`);
    fs.writeFileSync('reports/livelike-check.json', JSON.stringify({ at: new Date().toISOString(), mode: 'probe', base: BASE, ok: false, error: String(e.message).slice(0, 200) }, null, 2));
    process.exit(1);
  }
}

// ── smoke: Playwright 실클릭 (없으면 probe로 폴백) ──
let playwright;
try { playwright = (await import('@playwright/test')).chromium; }
catch {
  console.log('⚠️ @playwright/test 없음 — probe로 폴백');
  process.argv.push('--probe');
  const { spawn: sp } = await import('node:child_process');
  const c = sp('node', ['scripts/livelike-check.mjs', '--probe', '--base', BASE], { stdio: 'inherit' });
  process.exit(await new Promise((res) => c.on('close', res)));
}

const browser = await playwright.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const consoleErrors = [], pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));

const steps = [];
const step = async (id, title, fn) => {
  const t0 = Date.now();
  try { const note = await fn(); steps.push({ id, title, ok: true, ms: Date.now() - t0, note }); console.log('✅', id, title, note ? `(${note})` : ''); }
  catch (e) { steps.push({ id, title, ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 200) }); console.log('❌', id, title, '-', String(e.message).slice(0, 120)); }
};
const tap = async (text, o = {}) => { const l = page.getByText(text, { exact: o.exact ?? false }).nth(o.nth ?? 0); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.click(); };
const see = async (text, exact = false) => page.getByText(text, { exact }).first().waitFor({ state: 'visible', timeout: 10000 });
const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/livelike-${n}.png` }); };
const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(700); };

let loadMs = 0;
await step('L1', '환영 진입 (가입 언급 없음·둘러보기)', async () => {
  const t0 = Date.now(); await go('/'); await page.waitForTimeout(1200); loadMs = Date.now() - t0;
  await see('둘러보기'); await shot('L1-welcome'); await tap('둘러보기');
  return `${loadMs}ms`;
});
await step('L2', '위치→지구 입장 (비회원)', async () => {
  await see('어디에서 볼까요?'); await tap('🇰🇷 서울'); await shot('L2-location');
  await tap('지구로 들어가기'); await page.waitForTimeout(2200); await see('편지 쓰기'); await shot('L2-home');
});
await step('L3', '탭 순회 (편지·커뮤니티·상점·설정)', async () => {
  await go('/letters'); await see('아직 보낸 편지가 없어요'); await shot('L3-letters');
  await go('/community'); await see('km'); await shot('L3-community');
  await go('/store'); await see('썸원코인 충전'); await shot('L3-store');
  await go('/settings'); await see('기기 권한'); await shot('L3-settings');
});
await step('L4', '작성 1단계 (원화·도착시간 노출 금지)', async () => {
  await go('/compose');
  await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('스모크 테스트 편지예요. 오늘 하늘은 어떤 색인가요?');
  const t = await page.locator('body').innerText();
  if (t.includes('₩')) throw new Error('₩ 노출 (상점 외)');
  if (/후 도착|예상 도착/.test(t)) throw new Error('도착시간 노출');
  await shot('L4-compose');
});
await step('L5', '상점 규칙 (원화는 팩·플랜만·SC 표기)', async () => {
  await go('/store'); await see('₩3,900'); await see('아이템 (SC)'); await shot('L5-store');
});
await step('L6', '성능·오류 (pageerror 0)', async () => {
  if (pageErrors.length) throw new Error(pageErrors[0]);
  return `load ${loadMs}ms · console.err ${consoleErrors.length}`;
});

await browser.close();
const passed = steps.filter((s) => s.ok).length;
const summary = { at: new Date().toISOString(), mode: 'smoke', base: BASE, pass: passed, total: steps.length, loadMs, consoleErrors: consoleErrors.length, pageErrors, steps };
fs.writeFileSync('reports/livelike-check.json', JSON.stringify(summary, null, 2));
fs.writeFileSync(`${OUT}/livelike-results.json`, JSON.stringify(summary, null, 2));
console.log(`\nSMOKE: ${passed}/${steps.length} 통과 · load ${loadMs}ms · console.err ${consoleErrors.length} · page.err ${pageErrors.length}`);
if (consoleErrors.length) console.log('console 오류:\n' + consoleErrors.slice(0, 5).join('\n'));
process.exit(passed === steps.length && !pageErrors.length ? 0 : 1);
