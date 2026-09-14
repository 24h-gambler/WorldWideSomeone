/**
 * 사용자 관점 시나리오 자동 검증 v4 (390×844). 비회원 진입 → 투어 → 가입 게이트 → 편지 → 통과/장난 → 왕복(답장 가속) → 커뮤니티/직행 → 상점(코인 전용) → 대여 → 침수 → 다크 → 트래킹 → 신뢰성
 * 실행: npx expo export --platform web && npx serve dist -l 8081 -s → OUT=docs/screenshots BASE=http://localhost:8081 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshots.mjs
 */
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'docs/screenshots';
const BASE = process.env.BASE ?? 'http://localhost:8081';
const STORE_KEY = 'wws-v4';
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(`${OUT}/${f}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
const step = async (id, title, fn) => {
  const t0 = Date.now();
  try { const note = await fn(); results.push({ id, title, ok: true, ms: Date.now() - t0, note }); console.log('✅', id, title, note ? `(${note})` : ''); }
  catch (e) { results.push({ id, title, ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - t0 }); console.log('❌', id, title, '-', String(e.message).slice(0, 120)); await shot(`${id}-FAIL`); }
};
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const tap = async (text, { exact = false, nth = 0, timeout = 8000 } = {}) => { const loc = page.getByText(text, { exact }).nth(nth); await loc.waitFor({ state: 'visible', timeout }); await loc.click(); };
const see = async (text, timeout = 8000, exact = false) => page.getByText(text, { exact }).first().waitFor({ state: 'visible', timeout });
const go = async (path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(700); };
const state = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, STORE_KEY);
const events = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('wws-events') || '[]'); } catch { return []; } });
const noKrw = async (where) => { const t = await page.locator('body').innerText(); if (t.includes('₩')) throw new Error(`₩ shown outside store: ${where}`); };
const enableDev = async () => { await go('/settings'); const on = await page.getByText('머리 위 편지 소환').first().isVisible().catch(() => false); if (!on) { await page.getByRole('switch').last().click(); await page.waitForTimeout(300); } await page.mouse.wheel(0, 900); await page.waitForTimeout(300); };
const waitState = async (pred, timeout = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (pred(await state())) return; await page.waitForTimeout(1000); } throw new Error('waitState timeout'); };
const activeIds = (s) => new Set(s.passbys.filter((p) => !p.resolved && p.expiresAt > Date.now()).map((p) => p.id));
const spawnPassby = async (retry = 1) => { await enableDev(); const before = activeIds(await state()); await tap('머리 위 편지 소환'); try { await waitState((s) => [...activeIds(s)].some((id) => !before.has(id)), 30000); await page.getByText('머리 위를 지나가요').first().waitFor({ state: 'visible', timeout: 5000 }); } catch (e) { if (retry <= 0) throw e; console.log('  (passby late — retry spawn)'); return spawnPassby(retry - 1); } await page.waitForTimeout(500); };
const addCoins = async (n) => { await enableDev(); for (let i = 0; i < n; i++) await tap('+100 코인'); };
const ffUntil = async (pred, maxHours) => { if (pred(await state())) return; await enableDev(); for (let i = 0; i < maxHours; i++) { await tap('1시간 빨리감기'); await page.waitForTimeout(1100); if (pred(await state())) return; } throw new Error(`ffUntil: not satisfied after ${maxHours}h`); };
const signup = async (nick = 'dan') => { await tap('Google로 계속'); await page.getByPlaceholder('닉네임 (친구에게만 보여요)').last().fill(nick); await page.getByPlaceholder('한 줄 소개').last().fill('밤에 더 살아있는 사람'); await page.getByText('디자인', { exact: true }).last().click(); await page.getByText('러닝', { exact: true }).last().click(); await shot('signup-profile'); await page.getByText('시작하기', { exact: true }).last().click(); await page.waitForTimeout(800); };

// ── 1. 비회원 진입 · 투어 ─────────────────────────────
await step('01', '첫 진입 · 환영(가입 얘기 없음) → 둘러보기', async () => { await go('/'); await page.waitForTimeout(1200); await see('둘러보기'); const t = await page.locator('body').innerText(); if (/가입|로그인/.test(t.replace('가입 없이 바로 시작해요', ''))) throw new Error('signup mentioned on welcome'); await shot('01-welcome'); await tap('둘러보기'); });
await step('02', '위치 잡기(GPS 미허용 시 도시 선택) → 비회원으로 지구 입장', async () => { await see('어디에서 볼까요?'); await tap('🇰🇷 서울'); await page.waitForTimeout(600); await shot('02-location'); await tap('지구로 들어가기'); await page.waitForTimeout(2200); const s = await state(); if (s.signedIn) throw new Error('should be guest'); });
await step('03', '투어 · 한 군데씩 안내(짧은 CTA · 애니메이션) → 마지막 CTA "편지 쓰기"', async () => {
  await see('지금도 편지가 날아요'); await shot('03-tour-1'); await tap('다음', { exact: true }); await see('머리 위를 지나면 알림'); await shot('03b-tour-2'); await tap('다음', { exact: true }); await see('나라별 스토리'); await shot('03c-tour-3'); await tap('다음', { exact: true }); await see('커뮤니티', 8000, true); await tap('다음', { exact: true }); await see('첫 편지는 걸어서 가요'); await shot('03d-tour-5');
  await page.getByText('편지 쓰기', { exact: true }).last().click(); await page.waitForTimeout(800); await see('새 편지'); await shot('03e-compose-from-tour'); const s = await state(); if (!s.tourDone) throw new Error('tour not done');
});
await step('04', '홈(비회원) · 국가 스토리 · 지구(경로 숨김 · 착륙 편지 비공개) · 배달원 이동', async () => { await go('/'); await page.waitForTimeout(2000); await see('편지 쓰기'); await shot('04-home-guest'); await page.waitForTimeout(1500); await shot('04b-home-moving'); const s = await state(); return `landed(others) hidden, letters=${s.letters.length}`; });

// ── 2. 비회원 둘러보기 (탭) ──────────────────────────
await step('05', '편지 탭 · 빈 상태', async () => { await go('/letters'); await see('아직 보낸 편지가 없어요'); await shot('05-letters-empty'); });
await step('06', '친구 탭 · 해금 진행(대여 안내)', async () => { await go('/friends'); await see('다음 배달원'); await shot('06-friends-empty'); });
await step('07', '커뮤니티 · 피드(거리만 · 댓글) · 원화 표기 없음', async () => { await go('/community'); await see('km'); await see('댓글'); await noKrw('community'); await shot('07-community-feed'); });
await step('08', '커뮤니티 · 사람(받은 편지 수 · ⚡직행)', async () => { await tap('사람', { exact: true }); await see('컨택 가능성 높은 순'); await see('받은 편지'); await noKrw('people'); await shot('08-community-people'); });
await step('09', '프로필(비회원) · "가입하고 편지 보내기"', async () => { await go('/profile'); await see('둘러보는 중'); await see('가입하고 편지 보내기'); await shot('09-profile-guest'); });
await step('10', '상점 · 코인 팩(원화는 여기만) · 아이템은 SC · 플랜', async () => { await go('/store'); await see('썸원코인 충전'); await see('₩3,900'); await see('아이템 (SC)'); await shot('10-store'); await page.mouse.wheel(0, 900); await page.waitForTimeout(400); await shot('10b-store-items'); });
await step('11', '설정 · 권한 · 테마 · 백엔드(Supabase 미설정 → 로컬)', async () => { await go('/settings'); await see('기기 권한'); await see('로컬 봇 시뮬'); await shot('11-settings'); });

// ── 3. 가입 게이트 → 첫 편지 ─────────────────────────
await step('12', '편지 쓰기 3단계(비회원 가능) · 배달원 카드에 대여 SC · 원화 없음', async () => {
  await go('/compose'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('지금 이 편지를 읽는 당신, 오늘 하늘은 어떤 색인가요? 서울은 오렌지빛이에요.'); await shot('12-compose-text');
  await tap('다음', { exact: true }); await see('육지 어딘가'); await tap('📍 직접'); await tap('🇯🇵 도쿄'); await page.waitForTimeout(700); await tap('다음', { exact: true }); await see('느린 것부터 빠른 것까지'); await see('대여'); await noKrw('compose'); await shot('12b-compose-vehicle');
});
await step('13', '보내기 → 가입 게이트(SNS) → "나중에" → 다시 보내기 → Google → 프로필 → 발송', async () => {
  await page.getByText('보내기', { exact: true }).last().click(); await see('편지를 보내려면 계정이 필요해요');
  for (const p of ['Apple로 계속', 'Google로 계속', '카카오로 계속']) await page.getByText(p, { exact: true }).last().waitFor({ state: 'visible', timeout: 8000 });
  await shot('13-gate'); await tap('나중에', { exact: true }); await page.waitForTimeout(500);
  await page.getByText('보내기', { exact: true }).last().click(); await see('편지를 보내려면 계정이 필요해요'); await signup('dan');
  await page.waitForTimeout(600); await shot('13b-launch'); await page.waitForTimeout(2200); await see('자세히'); await see('내 편지'); await see('km/h'); await noKrw('home'); await shot('13c-home-after-send');
  const s = await state(); if (!s.signedIn || s.me.nickname !== 'dan') throw new Error('signup failed'); if (!s.letters.some((l) => l.senderId === 'me')) throw new Error('letter not sent');
  const t = await page.locator('body').innerText(); if (/후 도착|예상/.test(t)) throw new Error('ETA shown');
});

// ── 4. 통과 → 엿보기/끌어오기/경로/침수/잡기 ─────────
await step('14', '소환 → 통과 배너 → 잡기 화면: 되돌리기 없음 · 침수 · SC 표기', async () => {
  await spawnPassby(); await shot('14-home-passby'); await tap('보기', { exact: true }); await page.waitForTimeout(900); await see('엿보기', 8000, true); await see('침수', 8000, true);
  const t = await page.locator('body').innerText(); if (t.includes('되돌리기')) throw new Error('되돌리기 still present'); await noKrw('catch'); await shot('14b-catch');
});
await step('15', '첫 엿보기 렌즈로 미리보기 → 끌어오기 한도 → 상점', async () => { await tap('엿보기', { exact: true }); await see('엿봤어요'); await page.waitForTimeout(1500); await see('엿본 내용'); await shot('15-catch-peeked'); await tap('끌어오기', { exact: true }); await see('한도를 다 썼어요'); await page.waitForTimeout(1600); await see('플랜', 8000, true); });
await step('16', '경로 바꾸기(경유지 1)', async () => { await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(800); await tap('경로 바꾸기'); await see('경유지 0/1'); await tap('🇯🇵 도쿄'); await page.waitForTimeout(500); await shot('16-reroute'); await tap('경로 적용'); await page.waitForTimeout(2000); });
await step('17', '잡기 → 봉투 → 보낸 사람 실제 프로필 · 공유', async () => {
  await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(800); await page.getByText('잡기', { exact: true }).last().click(); await page.waitForTimeout(2000);
  await see('답장을 보내'); await see('프로필 · 엽서 보기'); await page.getByLabel('공유').first().waitFor({ state: 'visible' }); await shot('17-letter-revealed');
});
await step('18', '답장 편지 쓰기(직행 · 친구 요청) → 발송 → "왕복 진행 중"', async () => {
  await tap('답장 편지 쓰기'); await page.getByPlaceholder('편지 잘 받았어요…').fill('편지 잘 받았어요! 서울에서 잡았어요. 친구 해요 🙌'); await tap('다음', { exact: true }); await see('느린 것부터 빠른 것까지'); await tap('다음', { exact: true }); await see('친구 요청 포함'); await shot('18-reply-confirm'); await page.getByText('보내기', { exact: true }).last().click(); await page.waitForTimeout(2600);
  await go('/friends'); await see('왕복 진행 중'); await shot('18b-friends-roundtrip');
});

// ── 5. 오는 답장: 속도·거리만 · 코인 가속 → 수락 → 채팅 ─
await step('19', '답장 소환 → 우편함 "오는 중": 속도·거리만(도착 시간 없음) + 가속 버튼', async () => {
  await enableDev(); await tap('답장 편지 소환'); await page.waitForTimeout(500); await go('/letters'); await page.getByText('오는 중 · 도착 시간은 알 수 없어요').first().waitFor({ state: 'visible', timeout: 20000 }); await see('km/h'); await see('나와'); const t = await page.locator('body').innerText(); if (/후 도착|예상/.test(t)) throw new Error('ETA shown'); await noKrw('letters'); await shot('19-inbox-incoming');
});
await step('20', '코인 부족 → 상점 안내 · +코인 → "1분 안에" 가속 → 도착 → 수락하고 채팅 시작', async () => {
  await addCoins(3); await go('/letters'); await tap('1분 안에'); await page.waitForTimeout(600); await shot('20-boosted');
  await page.getByText('수락하고 채팅 시작').first().waitFor({ state: 'visible', timeout: 90000 }); await shot('20b-inbox-arrived'); await tap('수락하고 채팅 시작'); await page.waitForTimeout(900); await see('친구 · 실시간'); await shot('20c-chat-open');
  const s = await state(); return `friends=${s.friendIds.length}, coins=${s.me.coins}`;
});
await step('21', '실시간 채팅 · 보내기 → 봇 응답', async () => { await page.getByPlaceholder('메시지 보내기…').fill('안녕! 드디어 실시간이네 ✈️'); await tap('보내기', { exact: true }); await page.waitForTimeout(400); await page.waitForTimeout(9000); await shot('21-chat-reply'); });
await step('22', '내 답장 도착 → 상대 수락(봇) → 친구 2명 · 홈 친구 50km 원', async () => {
  const myReply = (s) => s.letters.find((l) => l.senderId === 'me' && l.kind === 'reply');
  await ffUntil((s) => myReply(s)?.status !== 'flying', 40);
  await waitState((s) => s.friendIds.length >= 2 || myReply(s)?.status === 'declined', 70000);
  const s = await state(); if (s.friendIds.length < 2) throw new Error('bot declined the reply (10%) — rerun');
  await go('/friends'); await see('메시지', 8000, true); await shot('22-friends'); await go('/'); await page.waitForTimeout(1500); await shot('22b-home-friend-disc'); return `friends=${s.friendIds.length}`;
});

// ── 6. 커뮤니티 · 스토리 · 좋아요/댓글 · 직행 편지 ───
await step('23', '내 편지 엽서 공개 → 피드 거리만 → 홈 스토리 "내 나라" → 스토리 순서(최신순)', async () => {
  const s = await state(); const mine = s.letters.find((l) => l.senderId === 'me' && l.kind === 'letter');
  await go(`/letter/${mine.id}`); await tap('커뮤니티에 엽서로 공개'); await page.waitForTimeout(500); await go('/community'); await see('dan'); await shot('23-community-my-post'); await go('/'); await page.waitForTimeout(1200); await see('내 나라'); await shot('23b-home-story-mine');
});
await step('24', '스토리 탭 → 엽서 상세에서 국가 공개 · 댓글', async () => { await tap('어딘가', { exact: true }); await page.waitForTimeout(800); await see('댓글'); await page.getByPlaceholder('댓글 달기…').fill('사진 너무 좋아요. 그곳의 밤은 어때요?'); await tap('게시', { exact: true }); await page.waitForTimeout(500); await see('사진 너무 좋아요'); await shot('24-post-comment'); });
await step('25', '⚡ 직행 편지(300 SC · 환불 없음) → 작성 → "직행 보내기" → 친구 탭 진행 중', async () => {
  await addCoins(3); await go('/community'); await tap('사람', { exact: true }); await page.getByText('⚡', { exact: true }).first().click(); await page.waitForTimeout(700); await see('직행 편지', 8000, true); await noKrw('user'); await shot('25-user-direct');
  await page.getByTestId('btn:user:direct').click(); await page.waitForTimeout(800); await see('직행 편지 · ???'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('직행으로 보냅니다. 답장은 마음대로!'); await tap('다음', { exact: true }); await see('받는 사람: ???'); await tap('다음', { exact: true }); await see('도착 보장'); await shot('25b-compose-direct'); await tap('직행 보내기'); await page.waitForTimeout(2600);
  await go('/friends'); await see('⚡ 직행 편지'); await shot('25c-friends-direct'); const s = await state(); const d = s.letters.find((l) => l.direct); return `coins=${s.me.coins}, direct=${!!d}`;
});

// ── 7. 상점 · 플랜 · 대여 · 침수 ─────────────────────
await step('26', '플랜(플러스) 테스트 결제 → 매월 SC 지급 · 한도 표시', async () => { await go('/store'); page.once('dialog', (d) => d.accept()); await tap('플러스 시작'); await page.waitForTimeout(800); await see('플러스 시작!'); await shot('26-store-plus'); const s = await state(); if (s.me.plan !== 'plus') throw new Error('plan'); return `coins=${s.me.coins}`; });
await step('27', '배달원 대여(SC)로 잠긴 여객기 1회 사용', async () => {
  await go('/compose'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('여객기 대여 테스트'); await tap('다음', { exact: true }); await tap('다음', { exact: true }); await tap('항공', { exact: true }); await page.getByTestId('vehicle:airliner').click(); await see('대여 ·'); await shot('27-compose-rental'); await page.getByText(/보내기 · 대여/).first().click(); await page.waitForTimeout(2600);
  const s = await state(); const r = s.letters.find((l) => l.rented); if (!r) throw new Error('not rented'); return `vehicle=${r.vehicle}, coins=${s.me.coins}`;
});
await step('28', '플러스 · 엿보기 → 끌어오기(내 위치로)', async () => {
  // 방어권·면역·초고속(지나가자마자 착륙) 편지는 건너뛰고 끌어올 수 있는 편지를 고른다 (끌어오기는 하루 1회라 한 번에 성공해야 함)
  const skip = new Set(['rocket', 'satellite', 'ufo', 'fighter', 'concorde', 'dragon', 'submarine', 'carpet', 'maglev', 'ktx', 'airliner', 'heli', 'prop', 'sports', 'truck', 'cruise', 'train']);
  for (let i = 0; i < 5; i++) {
    await spawnPassby(); const s = await state(); const pb = s.passbys.find((p) => !p.resolved && p.expiresAt > Date.now()); const l = pb && s.letters.find((x) => x.id === pb.letterId);
    if (!l || l.shield || skip.has(l.vehicle)) { console.log(`  (skip ${l?.vehicle} shield=${l?.shield})`); await tap('보기', { exact: true }); await page.waitForTimeout(600); await tap('그냥 보내주기'); await page.waitForTimeout(800); continue; }
    await tap('보기', { exact: true }); await page.waitForTimeout(800); await tap('엿보기', { exact: true }); await see('엿봤어요'); await page.waitForTimeout(1500); await shot('28-catch-peeked-plus');
    await tap('끌어오기', { exact: true }); await see('끌어왔어요'); await page.waitForTimeout(1600); await see('내게 오는 편지'); await shot('28-home-pulled'); return `pulled ${l.vehicle}`;
  }
  throw new Error('no pullable letter in 5 spawns');
});
await step('29', '침수 → 몇 시간 정지 → 지구 표시', async () => {
  // 방어권·바다 면역(돌고래·잠수함·드래곤)·초고속 편지는 건너뛰고 침수시킬 수 있는 편지를 고른다
  const skip = new Set(['dolphin', 'submarine', 'dragon', 'rocket', 'satellite', 'ufo', 'fighter', 'concorde', 'maglev', 'ktx', 'airliner', 'heli', 'prop', 'sports', 'truck', 'cruise', 'train']);
  let outcome = '';
  for (let i = 0; i < 6 && outcome !== 'sunk'; i++) {
    await spawnPassby(); const s0 = await state(); const pb = s0.passbys.find((p) => !p.resolved && p.expiresAt > Date.now()); const l = pb && s0.letters.find((x) => x.id === pb.letterId);
    await tap('보기', { exact: true }); await page.waitForTimeout(800);
    if (!l || l.shield || skip.has(l.vehicle)) { console.log(`  (skip ${l?.vehicle} shield=${l?.shield})`); await tap('그냥 보내주기'); await page.waitForTimeout(800); continue; }
    await tap('침수', { exact: true }); const t = await page.getByText(/침수!|튕겨나갔어요|건드릴 수 없어요|이미 착륙했어요/).first().textContent({ timeout: 8000 }); outcome = t.includes('침수!') ? 'sunk' : t.includes('튕겨') ? 'defended' : t.includes('착륙') ? 'gone' : 'immune'; await shot(outcome === 'sunk' ? '29-catch-sunk' : `29-catch-${outcome}-${i}`); await page.waitForTimeout(1800);
  }
  const s = await state(); const sunk = s.letters.find((l) => l.status === 'sunk'); if (!sunk) throw new Error(`no sunk letter (${outcome || 'no candidate'})`); await shot('29b-home-sunk'); return `sunkUntil in ${Math.round((sunk.sunkUntil - Date.now()) / 1000)}s`;
});

// ── 8. 다크 모드 · 트래킹 ────────────────────────────
await step('30', '다크 모드 · 홈/커뮤니티/편지/상점/잡기', async () => {
  await go('/settings'); await tap('다크', { exact: true }); await page.waitForTimeout(500); await go('/'); await page.waitForTimeout(1500); await shot('30-dark-home'); await go('/community'); await see('km'); await shot('30b-dark-community'); await go('/letters'); await page.waitForTimeout(600); await shot('30c-dark-letters'); await go('/store'); await page.waitForTimeout(600); await shot('30d-dark-store');
  await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(900); await shot('30e-dark-catch'); await tap('그냥 보내주기'); await go('/settings'); await tap('시스템', { exact: true });
});
await step('31', '트래킹 · 화면/버튼/스크롤/게이트/가입 이벤트가 비회원 시점부터 기록됨', async () => {
  const ev = await events(); const names = new Set(ev.map((e) => e.name));
  const need = ['screen_view', 'tap', 'scroll', 'gate_show', 'sign_up', 'guest_enter', 'tour_step', 'letter_send', 'coin_spend'];
  const missing = need.filter((n) => !names.has(n)); if (missing.length) throw new Error(`missing events: ${missing.join(',')}`);
  const guestEvents = ev.filter((e) => e.guest).length; if (!guestEvents) throw new Error('no guest events');
  return `${ev.length} buffered · ${names.size} kinds · guest ${guestEvents}`;
});

// ── 9. 통과 신뢰성 ───────────────────────────────────
const rel = [];
for (let i = 0; i < 3; i++) { try { await spawnPassby(0); rel.push('ok'); await tap('보기', { exact: true }); await page.waitForTimeout(700); await tap(i % 2 ? '우주로' : '달팽이', { exact: true }); await page.waitForTimeout(2200); } catch { rel.push('miss'); } }
results.push({ id: '32', title: `통과 알림 신뢰성 3회 (${rel.join(', ')})`, ok: rel.every((x) => x === 'ok') });
console.log('passby reliability:', rel.join(', '));

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
console.log(`done: ${results.filter((r) => r.ok).length}/${results.length} ok, console errors: ${errors.length}`);
await browser.close();
