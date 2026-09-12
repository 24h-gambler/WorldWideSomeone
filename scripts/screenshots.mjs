/**
 * 사용자 관점 시나리오 자동 검증 (390×844 폰 뷰포트). 단계별 스크린샷 → docs/screenshots, 결과 → docs/screenshots/results.json
 * 실행: npx expo export --platform web && npx serve dist -l 8080 -s  (다른 터미널) → CHROMIUM_PATH=... node scripts/screenshots.mjs
 */
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'docs/screenshots';
const BASE = process.env.BASE ?? 'http://localhost:8080';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
const step = async (id, title, fn) => {
  const t0 = Date.now();
  try { await fn(); results.push({ id, title, ok: true, ms: Date.now() - t0 }); console.log('✅', id, title); }
  catch (e) { results.push({ id, title, ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - t0 }); console.log('❌', id, title, '-', String(e.message).slice(0, 120)); await shot(`${id}-FAIL`); }
};
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const tap = async (text, { exact = false, nth = 0, timeout = 8000 } = {}) => { const loc = page.getByText(text, { exact }).nth(nth); await loc.waitFor({ state: 'visible', timeout }); await loc.click(); };
const see = async (text, timeout = 8000, exact = false) => page.getByText(text, { exact }).first().waitFor({ state: 'visible', timeout });
const go = async (path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(700); };

// ── 1. 온보딩 ────────────────────────────────────────────
await step('01', '온보딩 · 첫 화면(워드마크·지구·기능 3줄)', async () => { await go('/'); await page.waitForTimeout(1200); await see('시작하기'); await shot('01-onboarding-welcome'); });
await step('02', '온보딩 · 프로필(아바타·닉네임·태그)', async () => {
  await tap('시작하기'); await page.getByPlaceholder('닉네임 (친구에게만 보여요)').fill('dan'); await page.getByPlaceholder('한 줄 소개').fill('밤에 더 살아있는 사람');
  await tap('디자인', { exact: true }); await tap('러닝', { exact: true }); await tap('커피', { exact: true }); await shot('02-onboarding-profile');
});
await step('03', '온보딩 · 위치 선택(지구 탭/도시 칩/내 위치 버튼)', async () => { await tap('다음', { exact: true }); await see('위치를 선택하세요'); await shot('03-onboarding-location'); await tap('🇰🇷 서울'); await page.waitForTimeout(900); await see('대한민국'); await shot('03b-onboarding-location-picked'); });
await step('04', '홈 · 스토리 행 + 젠리 지구 + 편지 쓰기 CTA', async () => { await tap('지구로 들어가기'); await page.waitForTimeout(2200); await see('편지 쓰기'); await shot('04-home'); });

// ── 2. 탭 ────────────────────────────────────────────────
await step('05', '편지 탭 · 빈 상태(걷는 배달원 안내)', async () => { await go('/letters'); await see('아직 보낸 편지가 없어요'); await shot('05-letters-empty'); });
await step('06', '친구 탭 · 해금 진행 + 빈 상태', async () => { await go('/friends'); await see('다음 배달원'); await shot('06-friends-empty'); });
await step('07', '커뮤니티 · 엽서 피드(인스타 포스트)', async () => { await go('/community'); await see('좋아요'); await shot('07-community-feed'); });
await step('08', '커뮤니티 · 사람(??? 카드·컨택%)', async () => { await tap('사람', { exact: true }); await see('컨택 가능성 높은 순'); await shot('08-community-people'); });
await step('09', '커뮤니티 · 랭킹', async () => { await tap('랭킹', { exact: true }); await see('(나)'); await shot('09-community-rank'); });
await step('10', '프로필 · 인스타 레이아웃(링·통계·배달원 격납고)', async () => { await go('/profile'); await see('배달원'); await shot('10-profile'); });
await step('11', '상점 · 플랜 3종 + 아이템 + 성장 두 갈래', async () => { await go('/store'); await see('플러스'); await shot('11-store'); });
await step('12', '설정 · 실제 권한 상태(위치/알림) + 백엔드 모드', async () => { await go('/settings'); await see('기기 권한'); await shot('12-settings'); });

// ── 3. 첫 편지 ───────────────────────────────────────────
await step('13', '편지 쓰기 1 · 편지지', async () => { await go('/compose'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('지금 이 편지를 읽는 당신, 오늘 하늘은 어떤 색인가요? 서울은 오렌지빛이에요.'); await shot('13-compose-text'); });
await step('14', '편지 쓰기 2 · 목적지(랜덤/직접/경유지)', async () => { await tap('다음', { exact: true }); await see('육지 어딘가'); await shot('14-compose-dest-random'); await tap('📍 직접'); await tap('🇯🇵 도쿄'); await page.waitForTimeout(900); await shot('14b-compose-dest-pick'); });
await step('15', '편지 쓰기 3 · 배달원(걷기만 해금) · 방어권 · 조건 · 컨택%', async () => { await tap('다음', { exact: true }); await see('배달원', 8000, true); await shot('15-compose-vehicle'); await page.mouse.wheel(0, 700); await page.waitForTimeout(400); await shot('15b-compose-conditions'); });
await step('16', '편지 발송 → 출발 애니메이션 → 홈 포커스 카드', async () => { await tap('보내기', { exact: true }); await page.waitForTimeout(500); await shot('16-launch'); await page.waitForTimeout(2300); await see('자세히'); await shot('16b-home-after-send'); });

// ── 4. 머리 위 통과 → 잡기 / 경로 변경 ──────────────────
const enableDev = async () => { await go('/settings'); const on = await page.getByText('머리 위 편지 소환').first().isVisible().catch(() => false); if (!on) { await page.getByRole('switch').last().click(); await page.waitForTimeout(300); } await page.mouse.wheel(0, 900); await page.waitForTimeout(300); };
await step('17', '개발자 모드 · 편지 소환 → 홈 통과 배너', async () => {
  await enableDev(); await see('머리 위 편지 소환'); await shot('17-settings-dev'); await tap('머리 위 편지 소환');
  await page.getByText('잡기', { exact: true }).first().waitFor({ state: 'visible', timeout: 25000 }); await page.waitForTimeout(600); await shot('17b-home-passby');
});
await step('18', '잡기 화면 · 타이머 · 잡기/경로 바꾸기/달팽이/되돌리기/바다/우주', async () => { await tap('잡기', { exact: true }); await page.waitForTimeout(900); await see('경로 바꾸기'); await shot('18-catch'); });
await step('19', '경로 바꾸기 · 경유지 1개 찍고 적용(무료 플랜 한도 1)', async () => {
  await tap('경로 바꾸기'); await see('경유지 0/1'); await tap('🇯🇵 도쿄'); await page.waitForTimeout(600); await shot('19-catch-reroute');
  await tap('경로 적용'); await page.waitForTimeout(600); await shot('19b-reroute-result'); await page.waitForTimeout(1600);
});
await step('20', '두 번째 소환 → 잡기 → 편지 공개(봉투 애니메이션)', async () => {
  await enableDev(); await tap('머리 위 편지 소환'); await page.getByText('잡기', { exact: true }).first().waitFor({ state: 'visible', timeout: 25000 });
  await tap('잡기', { exact: true }); await page.waitForTimeout(800);
  const btn = page.getByText('잡기', { exact: true }).last(); await btn.click(); await page.waitForTimeout(700); await shot('20-catch-result'); await page.waitForTimeout(1300); await see('답장을 보내 친구가 되어보세요'); await shot('20b-letter-revealed');
});

// ── 5. 답장 → 승인 → 실시간 채팅 ───────────────────────
await step('21', '답장 편지 쓰기(직행 · 친구 요청 포함)', async () => {
  await tap('답장 편지 쓰기'); await page.getByPlaceholder('편지 잘 받았어요…').fill('편지 잘 받았어요! 서울에서 잡았어요. 친구 해요 🙌'); await shot('21-reply-compose');
  await tap('다음', { exact: true }); await see('배달원', 8000, true); await tap('다음', { exact: true }); await see('친구 요청 포함'); await shot('21b-reply-confirm'); await tap('보내기', { exact: true }); await page.waitForTimeout(2800);
});
await step('22', '채팅 잠김 상태(승인 전에는 편지로만)', async () => {
  await go('/friends'); await see('보낸 답장'); await shot('22-friends-pending');
  const otherId = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('wws-v2')).state; return s.letters.find((l) => l.senderId === 'me' && l.recipientId)?.recipientId; });
  await go(`/chat/${otherId}`); await see('편지로만 대화할 수 있어요'); await shot('22b-chat-locked');
});
await step('23', '봇 답장 소환 → 편지 탭 "답장" 도착 → 승인', async () => {
  await enableDev(); await tap('답장 편지 소환'); await page.waitForTimeout(500);
  await page.getByText('승인하고 채팅 시작').first().waitFor({ state: 'visible', timeout: 150000 }); await shot('23-letters-reply-inbox');
  await tap('승인하고 채팅 시작'); await page.waitForTimeout(900); await see('친구 · 실시간'); await shot('23b-chat-open');
});
await step('24', '실시간 채팅 · 보내기 → 봇 응답', async () => {
  await page.getByPlaceholder('메시지 보내기…').fill('안녕! 드디어 실시간이네 ✈️'); await tap('보내기', { exact: true }); await page.waitForTimeout(400); await shot('24-chat-sent');
  await page.waitForTimeout(10000); await shot('24b-chat-reply');
});
await step('25', '친구 탭 · 친구 1명(닉네임 공개) + 홈 스토리 링', async () => { await go('/friends'); await see('메시지'); await shot('25-friends-list'); await go('/'); await page.waitForTimeout(1500); await shot('25b-home-with-friend'); });
await step('26', '활동(알림) 목록', async () => { await go('/notifications'); await see('활동'); await shot('26-activity'); });
await step('27', '상점 · 테스트 결제(플러스) → 경유지 2개 반영', async () => {
  await go('/store'); page.once('dialog', (d) => d.accept()); await tap('플러스 시작'); await page.waitForTimeout(800); await see('플러스 시작!'); await shot('27-store-plus');
  await go('/compose'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('플러스 테스트'); await tap('다음', { exact: true }); await see('경유지 (2)'); await shot('27b-compose-plus-waypoints');
});

// ── 6. 통과 신뢰성 ───────────────────────────────────────
const rel = [];
for (let i = 0; i < 3; i++) {
  try { await enableDev(); await tap('머리 위 편지 소환'); await page.getByText('잡기', { exact: true }).first().waitFor({ state: 'visible', timeout: 25000 }); rel.push('ok'); await tap('잡기', { exact: true }); await page.waitForTimeout(700); await tap(i % 2 ? '바다에' : '달팽이 붙이기'); await page.waitForTimeout(2200); } catch { rel.push('miss'); }
}
results.push({ id: '28', title: `통과 알림 신뢰성 3회 (${rel.join(', ')})`, ok: rel.every((x) => x === 'ok') });
console.log('passby reliability:', rel.join(', '));

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
console.log(`done: ${results.filter((r) => r.ok).length}/${results.length} ok, console errors: ${errors.length}`);
await browser.close();
