/**
 * WWS 디자인 정적 검정 — 가독성·토큰 규칙 (무의존, 로컬/CI 동일).
 * 실행: node scripts/design-check.mjs [--json]
 * FAIL = 자동수정 클래스(깨짐·가독성·에러) → 바로 고침.
 * WARN = 제안 클래스(완성도) → design-proposal 이슈 → /승인 후 적용.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...a) => path.join(ROOT, ...a);
const read = (p) => fs.readFileSync(R(p), 'utf8');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const walk = (dir, exts = ['.ts', '.tsx']) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (['node_modules', 'dist'].includes(e.name)) continue; out.push(...walk(p, exts)); }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
};

const checks = [];
const ok = (id, title, detail = '') => checks.push({ id, title, ok: true, detail });
const fail = (id, title, detail = '') => checks.push({ id, title, ok: false, detail });
const warns = [];
const warn = (msg) => warns.push(msg);

// WCAG 상대휘도·명도대비
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ── 테마 파싱 ──
const theme = read('src/theme/index.ts');
const lightSrc = theme.slice(theme.indexOf('light: {'), theme.indexOf('dark: {'));
const darkSrc = theme.slice(theme.indexOf('dark: {'));
const cols = (s) => Object.fromEntries([...s.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));
const L = cols(lightSrc), D = cols(darkSrc);

// ── D1 본문 명도 (FAIL < 4.5) — 자동수정 클래스 ──
{
  const pairs = [
    ['light', 'text', 'bg'], ['light', 'text', 'bg2'], ['light', 'text2', 'bg'], ['light', 'text2', 'bg2'],
    ['light', 'paperText', 'paper'], ['dark', 'text', 'bg'], ['dark', 'text2', 'bg'], ['dark', 'paperText', 'paper'],
  ];
  const bad = [];
  for (const [s, f, b] of pairs) {
    const P = s === 'light' ? L : D;
    if (!P[f] || !P[b]) { bad.push(`${s}.${f}/${b} 토큰없음`); continue; }
    const r = contrast(P[f], P[b]);
    if (r < 4.5) bad.push(`${s} ${f} on ${b} = ${r.toFixed(2)}`);
  }
  if (!bad.length) ok('D1', '본문 명도 ≥4.5', 'text/text2/paperText 8쌍 통과');
  else fail('D1', '본문 명도 ≥4.5', bad.join(' | ').slice(0, 400));
}

// ── D2 보조·강조 명도 (WARN < 4.5/3.0) — 제안 클래스 ──
{
  const list = [];
  const check = (s, f, b, min) => {
    const P = s === 'light' ? L : D;
    if (!P[f] || !P[b]) return;
    const r = contrast(P[f], P[b]);
    if (r < min) list.push(`${s} ${f} on ${b} = ${r.toFixed(2)} (기준 ${min})`);
  };
  for (const s of ['light', 'dark']) {
    check(s, 'text3', 'bg', 3.0); check(s, 'text3', 'bg2', 3.0);
    check(s, 'paperMuted', 'paper', 3.0);
    check(s, 'yellowText', 'yellowSoft', 4.5);
    check(s, 'blue', 'bg', 4.5); check(s, 'red', 'bg', 4.5); check(s, 'green', 'bg', 4.5);
  }
  ok('D2', '보조·강조 명도 스캔', list.length ? 'WARN ' + list.length + '건' : '위반 없음');
  for (const m of list) warn('D2 ' + m + ' → 링크/대형 전용 유지 또는 토큰 조정 제안');
}

// ── D3 폰트 크기 (FAIL <10 · WARN =10) ──
{
  const bad = [], w10 = [];
  for (const f of walk(R('src'))) {
    if (rel(f) === 'src/theme/index.ts') continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/fontSize:\s*(\d+)/g)) {
      const n = +m[1];
      if (n < 10) { bad.push(`${rel(f)}:${n}`); break; }
      if (n === 10) { w10.push(rel(f)); break; }
    }
  }
  // 토큰 최소값 확인 (caption 11)
  const sizes = [...theme.matchAll(/fontSize:\s*(\d+)/g)].map((m) => +m[1]);
  const minTok = Math.min(...sizes);
  if (bad.length) fail('D3', '폰트 최소 크기', bad.slice(0, 8).join(', '));
  else ok('D3', '폰트 최소 크기', `토큰 최소 ${minTok} · 하드코딩 <10 없음`);
  if (minTok < 10) warn(`D3 토큰 최소값 ${minTok} < 10`);
  for (const w of [...new Set(w10)].slice(0, 8)) warn(`D3 ${w}에 fontSize 10 — 캡션 토큰(11) 사용 검토`);
}

// ── D4 줄간격 (FAIL lineHeight < fontSize) ──
{
  const typeBlock = theme.slice(theme.indexOf('export const type'));
  const pairs = [...typeBlock.matchAll(/fontSize:\s*(\d+)[^}]*?lineHeight:\s*(\d+)/g)].map((m) => [+m[1], +m[2]]);
  const bad = pairs.filter(([fs, lh]) => lh < fs);
  if (!bad.length) ok('D4', '줄간격 ≥ 폰트', `${pairs.length}개 스타일 통과`);
  else fail('D4', '줄간격 ≥ 폰트', bad.map(([a, b]) => `${a}/${b}`).join(', '));
}

// ── D5 하드코딩 색상 (WARN — 토큰 사용 권장, 아트 제외) ──
{
  const skip = new Set(['src/theme/index.ts', 'src/components/vehicle-art.tsx', 'src/components/item-art.tsx']);
  const hits = [];
  for (const f of [...walk(R('src/app')), ...walk(R('src/components'))]) {
    const r = rel(f);
    if (skip.has(r) || r.includes('/globe/')) continue;
    const t = fs.readFileSync(f, 'utf8');
    const n = (t.match(/#[0-9A-Fa-f]{6}/g) || []).length;
    if (n > 0) hits.push(`${r}(${n})`);
  }
  ok('D5', '하드코딩 색상 스캔', hits.length ? `${hits.length}개 파일` : '없음');
  for (const h of hits.slice(0, 12)) warn(`D5 ${h} — 테마 토큰 사용 검토`);
}

// ── 출력 ──
const failed = checks.filter((c) => !c.ok);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ok: !failed.length, checks, warns }, null, 2));
} else {
  for (const c of checks) console.log(`${c.ok ? '✅' : '❌'} ${c.id} ${c.title}${c.detail ? ` — ${c.detail}` : ''}`);
  for (const w of warns.slice(0, 20)) console.log(`⚠️ ${w}`);
  if (warns.length > 20) console.log(`⚠️ …외 ${warns.length - 20}건 (제안 큐)`);
  console.log(`\n${checks.length - failed.length}/${checks.length} 통과 · 제안 ${warns.length}건`);
}
process.exit(failed.length ? 1 : 0);
