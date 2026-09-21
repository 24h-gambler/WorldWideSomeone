/**
 * WWS 비주얼 체크 — 실앱을 돌아다니며 스크린샷 회귀 + 깨짐 탐지.
 * 무의존(PNG 코덱 내장, node:zlib만) + @playwright/test(주행용).
 *   node scripts/visual-check.mjs [--update] [--base URL] [--selftest]
 * --update: 베이스라인 재생성 후 exit 0 (수동/dispatch 전용)
 * --selftest: 코덱 자가검증 (playwright 불필요)
 * BASE 미도달·playwright 없음·앱 pending → SKIPPED扱い exit 0.
 * routes/threshold는 design.apps.json (APP env로 3앱 병렬, 기본 worldwidesomeone).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const SELFTEST = args.includes('--selftest');
const baseArg = args[args.indexOf('--base') + 1];
const BASE = (baseArg && !baseArg.startsWith('--') ? baseArg : null) || process.env.LIVE_URL || process.env.BASE || 'http://localhost:8081';
const APP = process.env.APP || 'worldwidesomeone';
const OUT = path.join(ROOT, 'docs/screenshots');
const BASEDIR = path.join(OUT, 'baseline', APP);
fs.mkdirSync('reports', { recursive: true });

// ── 미니 PNG 코덱 (8bit · non-interlace · gray/RGB/RGBA) ──
const CRC_T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const encodePNG = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
const decodePNG = (buf) => {
  let pos = 8; const idat = [];
  let w, h, bitDepth, colorType, interlace;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 6].includes(colorType)) throw new Error(`unsupported PNG (depth=${bitDepth} color=${colorType} interlace=${interlace})`);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, rgba = Buffer.alloc(w * h * 4);
  let p = 0;
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      const v = raw[p++];
      line[i] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 0xFF;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (ch === 4) { rgba[o] = line[s]; rgba[o + 1] = line[s + 1]; rgba[o + 2] = line[s + 2]; rgba[o + 3] = line[s + 3]; }
      else if (ch === 3) { rgba[o] = line[s]; rgba[o + 1] = line[s + 1]; rgba[o + 2] = line[s + 2]; rgba[o + 3] = 255; }
      else { rgba[o] = rgba[o + 1] = rgba[o + 2] = line[s]; rgba[o + 3] = 255; }
    }
    prev.set(line); // == line.copy(prev) — Buffer.set 사용
  }
  return { w, h, data: rgba };
};
const diffImages = (a, b, tol = 16) => {
  if (a.w !== b.w || a.h !== b.h) return { ratio: 1, diff: -1, sizeMismatch: true };
  let d = 0; const mark = Buffer.from(a.data);
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > tol || Math.abs(a.data[i + 1] - b.data[i + 1]) > tol || Math.abs(a.data[i + 2] - b.data[i + 2]) > tol) {
      d++; mark[i] = 255; mark[i + 1] = 0; mark[i + 2] = 0; mark[i + 3] = 255;
    }
  }
  return { ratio: d / (a.w * a.h), diff: d, mark };
};

// ── --selftest: 코덱 자가검증 ──
if (SELFTEST) {
  const W = 37, H = 23;
  const img = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; img[o] = (x * 7) % 256; img[o + 1] = (y * 11) % 256; img[o + 2] = (x + y) % 256; img[o + 3] = 255; }
  const rt = decodePNG(encodePNG(W, H, img));
  if (rt.w !== W || rt.h !== H || !rt.data.equals(img)) { console.log('❌ roundtrip 실패'); process.exit(1); }
  const mod = Buffer.from(img); let expect = 0;
  for (let x = 0; x < 10; x++) { const o = x * 4; mod[o] = (mod[o] + 100) % 256; expect++; }
  const dd = diffImages({ w: W, h: H, data: img }, { w: W, h: H, data: mod });
  const same = diffImages({ w: W, h: H, data: img }, { w: W, h: H, data: Buffer.from(img) });
  console.log(`✅ selftest: roundtrip OK · 변경 10px 검출=${dd.diff} · 동일비교=${same.diff}`);
  process.exit(dd.diff === expect && same.diff === 0 ? 0 : 1);
}

// ── 앱 설정 ──
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'design.apps.json'), 'utf8')).apps;
const app = apps.find((a) => a.id === APP) || apps[0];
if (app.status !== 'active') {
  console.log(`⏭️ visual-check SKIPPED — ${app.id} (${app.status})`);
  fs.writeFileSync('reports/visual-check.json', JSON.stringify({ at: new Date().toISOString(), app: app.id, status: 'skipped', reason: app.status }, null, 2));
  process.exit(0);
}
fs.mkdirSync(BASEDIR, { recursive: true });

// BASE 도달 확인
try { await fetch(BASE, { signal: AbortSignal.timeout(8000) }); }
catch { console.log(`⏭️ visual-check SKIPPED — BASE 미도달 (${BASE})`); process.exit(0); }

let chromium;
try { chromium = (await import('@playwright/test')).chromium; }
catch { console.log('⏭️ visual-check SKIPPED — @playwright/test 없음 (npm ci 필요)'); process.exit(0); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
// 프라이밍: cold deep-link는 웰컴 게이트가 가로채 전 라우트가 같은 화면으로 찍힌다.
// 실사용자처럼 웰컴→위치→지구 진입 후 순회해야 라우트별 화면이 나온다.
{
  const tap = async (text) => {
    const l = page.getByText(text, { exact: false }).first();
    await l.waitFor({ state: 'visible', timeout: 15000 });
    await l.click();
  };
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await tap('둘러보기');
  await tap('🇰🇷 서울');
  await tap('지구로 들어가기');
  // 홈 준비 대기 (지구 초기화 전 이동하면 다음 라우트가 깨진다 — smoke도 '편지 쓰기'를 기다린다)
  await page.getByText('편지 쓰기', { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
}

// 라우트별 준비 신호 — smoke와 같은 텍스트를 같은 타임아웃으로 기다린다.
// (옛 settle 방식은 라이브 영역 때문에 안정 조건을 못 맞췄고, smoke와 결과가 엇갈렸다)
const READY_TEXT = {
  '/': '편지 쓰기',
  '/letters': '아직 보낸 편지가 없어요',
  '/community': 'km',
  '/store': '썸원코인 충전',
  '/settings': '기기 권한',
};
const READY_PLACEHOLDER = { '/compose': '지금 이 편지를 읽는 당신에게…' };
const results = [];
for (const route of app.routes) {
  const id = route === '/' ? 'root' : route.replace(/\//g, '_').replace(/^_/, '');
  const base = path.join(BASEDIR, `${id}.png`);
  const entry = { route, ok: true, notes: [], warns: [] };
  // --update 모드에서는 깨짐 탐지를 경고로 격하한다 (베이스라인 확정 우선.
  // 다음 일반 실행에서 같은 깨짐이 FAIL로 뜬다). pageerror·렌더실패·회귀는 항상 FAIL.
  const soft = (msg) => {
    if (UPDATE) { entry.warns.push(msg); console.log('   ⚠️', msg); }
    else { entry.ok = false; entry.error = (entry.error ? entry.error + ' | ' : '') + msg; }
  };
  try {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    // 준비 신호 대기 (smoke와 동일) — 없으면 렌더 실패로 기록 (smoke도 실패하므로 신호가 일치한다)
    if (READY_PLACEHOLDER[route]) {
      await page.getByPlaceholder(READY_PLACEHOLDER[route]).first().waitFor({ state: 'visible', timeout: 15000 });
    } else if (READY_TEXT[route]) {
      await page.getByText(READY_TEXT[route], { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
    } else {
      await page.waitForTimeout(2000);
    }
    const settled = await page.evaluate(() => ({ len: (document.body ? document.body.innerText.length : 0) }));
    entry.settledLen = settled.len;
    await page.waitForTimeout(800);
    const tmp = path.join(os.tmpdir(), `wws-vis-${id}.png`);
    await page.screenshot({ path: tmp, animations: 'disabled' });
    const cur = decodePNG(fs.readFileSync(tmp));
    if (!fs.existsSync(base) || UPDATE) {
      fs.writeFileSync(base, encodePNG(cur.w, cur.h, cur.data));
      if (UPDATE) fs.copyFileSync(tmp, path.join(ROOT, 'reports', `visual-raw-${id}.png`)); // 사람 눈확인용 원본 (아티팩트용, git 제외)
      entry.notes.push(UPDATE || !fs.existsSync(base) ? 'baseline 저장' : '');
      entry.updated = true;
    } else {
      const ref = decodePNG(fs.readFileSync(base));
      const d = diffImages(ref, cur);
      entry.diffRatio = +d.ratio.toFixed(4); entry.diffPx = d.diff;
      if (d.sizeMismatch || d.ratio > app.threshold) {
        entry.ok = false; entry.error = d.sizeMismatch ? '사이즈 변경' : `픽셀 회귀 ${(d.ratio * 100).toFixed(2)}% (기준 ${(app.threshold * 100).toFixed(2)}%)`;
        if (!d.sizeMismatch) fs.writeFileSync(path.join(BASEDIR, `${id}.diff.png`), encodePNG(cur.w, cur.h, d.mark));
      }
    }
    if (errs.length) { entry.ok = false; entry.error = (entry.error ? entry.error + ' | ' : '') + 'pageerror: ' + errs[0]; }
    // 깨짐 탐지: 가로 오버플로
    const overflow = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (out.length >= 8) break;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (cs.overflowX !== 'visible') continue;
        if (el.scrollWidth - el.clientWidth > 2 && el.clientWidth > 0) {
          out.push(`${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className ?? '').toString().split(' ').slice(0, 2).join('.')}`.slice(0, 80));
        }
      }
      return out;
    });
    if (overflow.length) soft('가로 넘침: ' + overflow.slice(0, 4).join(', '));
    // 탭타겟: 24px 미만 양축 → FAIL, 24~44 → note
    const small = await page.evaluate(() => {
      const bad = [], tiny = [];
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.top < -50 || r.top > innerHeight + 50) continue;
        const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 20);
        if (r.width < 24 && r.height < 24) bad.push(`${label}(${Math.round(r.width)}x${Math.round(r.height)})`);
        else if ((r.width < 44 || r.height < 44) && tiny.length < 6) tiny.push(`${label}(${Math.round(r.width)}x${Math.round(r.height)})`);
      }
      return { bad: bad.slice(0, 6), tiny };
    });
    if (small.bad.length) soft('탭타겟 미달: ' + small.bad.join(', '));
    if (small.tiny.length) entry.notes.push('44px 미만: ' + small.tiny.join(', '));
    console.log(`${entry.ok ? '✅' : '❌'} VIS ${route}${entry.diffRatio !== undefined ? ` diff ${(entry.diffRatio * 100).toFixed(2)}%` : ''}${entry.error ? ' — ' + entry.error : ''}`);
  } catch (e) { entry.ok = false; entry.error = String(e.message).slice(0, 200); console.log(`❌ VIS ${route} — ${entry.error}`); }
  results.push(entry);
}
await browser.close();
const failed = results.filter((r) => !r.ok);
const summary = { at: new Date().toISOString(), app: app.id, base: BASE, update: UPDATE, ok: !failed.length, pass: results.length - failed.length, total: results.length, threshold: app.threshold, results };
fs.writeFileSync('reports/visual-check.json', JSON.stringify(summary, null, 2));
console.log(UPDATE ? `\nBASELINE 저장: ${results.length}개 → ${BASEDIR}` : `\nVISUAL: ${summary.pass}/${summary.total} 통과`);
process.exit(failed.length ? 1 : 0);
