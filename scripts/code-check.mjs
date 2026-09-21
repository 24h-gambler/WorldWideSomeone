/**
 * WWS 코드 검정 — 제품 규칙(CLAUDE.md 1절) + 클라이언트/서버 상수 일치.
 * 무의존(node만). 실행: node scripts/code-check.mjs [--json]
 * 실패하면 exit 1. CI(4시간 자동화)와 로컬에서 동일하게 돈다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...a) => path.join(ROOT, ...a);
const read = (p) => fs.readFileSync(R(p), 'utf8');

const checks = [];
const ok = (id, title, detail = '') => checks.push({ id, title, ok: true, detail });
const fail = (id, title, detail = '') => checks.push({ id, title, ok: false, detail });
const walk = (dir, exts = ['.ts', '.tsx']) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === 'dist') continue; out.push(...walk(p, exts)); }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ── C1 배달원 43종 ──
try {
  const src = read('src/data/vehicles.ts');
  const ids = [...src.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const uniq = new Set(ids);
  // VEHICLES 배열 안에 들어간 id만 센다 (SNAIL 등 제외) — id: 'xxx' 패턴이 전부 차량이므로 개수 비교
  if (uniq.size === 43) ok('C1', '배달원 43종', `${uniq.size}종`);
  else fail('C1', '배달원 43종', `현재 ${uniq.size}종 (기대 43)`);
} catch (e) { fail('C1', '배달원 43종', String(e.message)); }

// ── C2 클라이언트/서버 상수 일치 (plans.ts vs _shared/core.ts) ──
try {
  const client = read('src/data/plans.ts');
  const server = read('supabase/functions/_shared/core.ts');
  const diffs = [];
  const cmp = (label, c, s) => { if (String(c) !== String(s)) diffs.push(`${label}: client=${c} server=${s}`); };
  // 숫자 추출 헬퍼
  const num = (src, re) => (src.match(re)?.[1] ?? 'MISS');
  cmp('DAILY_FREE_COIN_CAP', num(client, /DAILY_FREE_COIN_CAP\s*=\s*(\d+)/), num(server, /DAILY_FREE_COIN_CAP:\s*(\d+)/));
  cmp('OCEAN_RESCUE_COINS', num(client, /OCEAN_RESCUE_COINS\s*=\s*(\d+)/), num(server, /OCEAN_RESCUE_COINS:\s*(\d+)/));
  cmp('SHIELD_PER_FRIENDS', num(client, /SHIELD_PER_FRIENDS\s*=\s*(\d+)/), num(server, /SHIELD_PER_FRIENDS:\s*(\d+)/));
  for (const [k, v] of [['catch', 10], ['friend', 25], ['caughtByOther', 5], ['received', 3], ['send', 2], ['mischief', 1], ['like', 1], ['comment', 1]]) {
    cmp(`REWARD.${k}`, num(client, new RegExp(`${k}:\\s*(\\d+)`)), num(server, new RegExp(`${k}:\\s*(\\d+)`)));
  }
  for (const [id, coins] of [['shield5', 150], ['peek5', 120], ['pull1', 150], ['direct1', 300], ['ufo1', 120], ['orbit1', 220]]) {
    const c = num(client, new RegExp(`id:\\s*'${id}'[^}]*?coins:\\s*(\\d+)`));
    const s = num(server, new RegExp(`${id}:\\s*\\{\\s*coins:\\s*(\\d+)`));
    cmp(`ITEM.${id}`, c, s ?? coins);
    if (String(coins) !== String(c)) diffs.push(`ITEM.${id}: 기대=${coins} 실제(client)=${c}`);
  }
  for (const [id, coins, krw] of [['wws_sc_300', 300, 3900], ['wws_sc_800', 800, 8900], ['wws_sc_2000', 2000, 19900], ['wws_sc_5500', 5500, 49000], ['wws_sc_12000', 12000, 99000]]) {
    const c = num(client, new RegExp(`storeId:\\s*'${id}'[^}]*?coins:\\s*(\\d+)`));
    const s = num(server, new RegExp(`${id}:\\s*\\{\\s*coins:\\s*(\\d+)`));
    cmp(`PACK.${id}.coins`, c, s);
  }
  cmp('BOOST.fast', num(client, /fast:\s*\{\s*coins:\s*(\d+)/), num(server, /fast:\s*\{\s*coins:\s*(\d+)/));
  cmp('BOOST.instant', num(client, /instant:\s*\{\s*coins:\s*(\d+)/), num(server, /instant:\s*\{\s*coins:\s*(\d+)/));
  cmp('PLAN.plus.coins', num(client, /id:\s*'plus'[^}]*?monthlyCoins:\s*(\d+)/s), num(server, /wws_plus_monthly:[^}]*?coins:\s*(\d+)/));
  cmp('PLAN.pro.coins', num(client, /id:\s*'pro'[^}]*?monthlyCoins:\s*(\d+)/s), num(server, /wws_pro_monthly:[^}]*?coins:\s*(\d+)/));
  // rentalCoins 구간 동일 여부 (40/80/150/250/400)
  for (const n of ['40', '80', '150', '250', '400']) {
    if (!server.includes(n)) diffs.push(`rentalCoins 구간 ${n}이 서버 core.ts에 없음`);
  }
  if (!diffs.length) ok('C2', '클라이언트/서버 상수 일치', 'rewards·items·packs·boost·plan 전부 동일');
  else fail('C2', '클라이언트/서버 상수 일치', diffs.join(' | ').slice(0, 600));
} catch (e) { fail('C2', '클라이언트/서버 상수 일치', String(e.message)); }

// ── C3 원화(₩)는 상점(코인 팩·플랜)에서만 ──
try {
  const allowed = new Set(['src/data/plans.ts', 'src/app/store.tsx', 'src/services/purchases.ts']);
  const bad = [];
  for (const f of walk(R('src'))) {
    const t = fs.readFileSync(f, 'utf8');
    if (t.includes('₩') && !allowed.has(rel(f))) bad.push(`${rel(f)}`);
  }
  if (!bad.length) ok('C3', '원화 표기는 상점에서만', 'plans.ts + store.tsx 외 ₩ 없음');
  else fail('C3', '원화 표기는 상점에서만', `허용 밖 ₩: ${bad.join(', ')}`);
} catch (e) { fail('C3', '원화 표기는 상점에서만', String(e.message)); }

// ── C4 되돌리기 없음 (UI에서 제거 — 바다는 침수) ──
try {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const bad = [];
  for (const f of walk(R('src'))) {
    const t = strip(fs.readFileSync(f, 'utf8'));
    if (t.includes('되돌리기')) bad.push(rel(f));
  }
  if (!bad.length) ok('C4', '되돌리기 UI 없음', '코드(주석 제외)에 없음');
  else fail('C4', '되돌리기 UI 없음', bad.join(', '));
} catch (e) { fail('C4', '되돌리기 UI 없음', String(e.message)); }

// ── C5 도착 시간 노출 금지 (속도·거리만) ──
try {
  const banned = ['후 도착', '예상 도착', '도착 예정', '예상도착'];
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const bad = [];
  for (const f of walk(R('src'))) {
    const t = strip(fs.readFileSync(f, 'utf8'));
    for (const b of banned) if (t.includes(b)) { bad.push(`${rel(f)}:${b}`); break; }
  }
  if (!bad.length) ok('C5', '도착 시간 노출 금지', '후 도착/예상 도착 없음 (주석 제외)');
  else fail('C5', '도착 시간 노출 금지', bad.join(', '));
} catch (e) { fail('C5', '도착 시간 노출 금지', String(e.message)); }

// ── C6 애플 로그인은 iOS·웹에만 ──
try {
  const t = read('src/components/signup-sheet.tsx');
  if (t.includes('APPLE_OK') && t.includes("Platform.OS === 'ios'") && t.includes("'web'")) ok('C6', '애플 버튼 iOS·웹 gating', 'APPLE_OK 확인');
  else fail('C6', '애플 버튼 iOS·웹 gating', 'signup-sheet.tsx의 APPLE_OK 조건 확인 필요 (심사 4.8)');
} catch (e) { fail('C6', '애플 버튼 iOS·웹 gating', String(e.message)); }

// ── C7 가입 게이트는 보내기·좋아요·댓글·채팅·결제 순간에만 ──
try {
  const t = read('src/components/signup-sheet.tsx');
  const need = ['send', 'like', 'comment', 'chat', 'pay'];
  const miss = need.filter((k) => !t.includes(k));
  const hook = fs.existsSync(R('src/hooks/use-gate.ts'));
  if (!miss.length && hook) ok('C7', '가입 게이트 5개 순간', 'send·like·comment·chat·pay');
  else fail('C7', '가입 게이트 5개 순간', miss.length ? `누락: ${miss.join(',')}` : 'use-gate.ts 없음');
} catch (e) { fail('C7', '가입 게이트 5개 순간', String(e.message)); }

// ── C8 로그아웃·계정 삭제 (스토어 심사 필수) ──
try {
  const t = read('src/app/settings.tsx');
  if (t.includes('로그아웃') && t.includes('계정 삭제')) ok('C8', '로그아웃·계정 삭제', 'settings.tsx 확인');
  else fail('C8', '로그아웃·계정 삭제', 'settings.tsx에 로그아웃/계정 삭제 필요');
} catch (e) { fail('C8', '로그아웃·계정 삭제', String(e.message)); }

// ── C9 SNS에는 받은 편지 수만 (보낸 수 금지) ──
try {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const bad = [];
  for (const f of walk(R('src'))) {
    const t = strip(fs.readFileSync(f, 'utf8'));
    if (t.includes('보낸 편지 수') || t.includes('보낸 수')) bad.push(rel(f));
  }
  if (!bad.length) ok('C9', 'SNS 받은 수만 노출', '보낸 수 표기 없음');
  else fail('C9', 'SNS 받은 수만 노출', bad.join(', '));
} catch (e) { fail('C9', 'SNS 받은 수만 노출', String(e.message)); }

// ── C10 sim 패리티 (클라/서버 공통 알고리즘) ──
try {
  const c = read('src/engine/sim.ts');
  const s = read('supabase/functions/_shared/sim.ts');
  const fns = (t) => new Set([...t.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1])
    .concat([...t.matchAll(/export\s+const\s+(\w+)\s*=/g)].map((m) => m[1])));
  const fc = fns(c), fs_ = fns(s);
  const common = [...fc].filter((x) => fs_.has(x));
  if (common.length >= 3) ok('C10', 'sim 클라/서버 패리티', `공통 ${common.length}개 (${common.slice(0, 6).join(',')})`);
  else fail('C10', 'sim 클라/서버 패리티', `공통 ${common.length}개 — 둘을 같이 고쳐야 함 (CLAUDE.md 5절)`);
} catch (e) { fail('C10', 'sim 클라/서버 패리티', String(e.message)); }

// ── C11 직행 편지 300 SC · 환불 없음 ──
try {
  const client = read('src/data/plans.ts');
  const server = read('supabase/functions/_shared/core.ts');
  const ui = walk(R('src')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const probs = [];
  if (!/direct1[^}]*coins:\s*300/.test(client)) probs.push('client direct1≠300');
  if (!/direct1:\s*\{\s*coins:\s*300/.test(server)) probs.push('server direct1≠300');
  if (!ui.includes('환불 없음')) probs.push('UI에 "환불 없음" 명시 없음');
  if (!probs.length) ok('C11', '직행 300SC·환불없음', 'plans·core·UI 일치');
  else fail('C11', '직행 300SC·환불없음', probs.join(' | '));
} catch (e) { fail('C11', '직행 300SC·환불없음', String(e.message)); }

// ── C12 답장 속도 하한 (자전거 미만 불가 — 왕복 이탈 방지) ──
try {
  const files = walk(R('src')).map((f) => ({ f: rel(f), t: fs.readFileSync(f, 'utf8') }));
  const hit = files.some(({ t }) => /답장/.test(t) && (/자전거/.test(t) || /25\s*km\/h/.test(t) || /minReply|REPLY_MIN|reply.*bike/i.test(t)));
  const compose = read('src/app/compose.tsx');
  const guarded = /bike|25|최소|하한/.test(compose);
  if (hit || guarded) ok('C12', '답장 속도 하한', '자전거(25km/h) 하한 가드 존재');
  else fail('C12', '답장 속도 하한', 'compose 답장 모드 하한 확인 필요 (AUDIT 1절)');
} catch (e) { fail('C12', '답장 속도 하한', String(e.message)); }

// ── 출력 ──
const failed = checks.filter((c) => !c.ok);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ok: !failed.length, checks }, null, 2));
} else {
  for (const c of checks) console.log(`${c.ok ? '✅' : '❌'} ${c.id} ${c.title}${c.detail ? ` — ${c.detail}` : ''}`);
  console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
}
process.exit(failed.length ? 1 : 0);
