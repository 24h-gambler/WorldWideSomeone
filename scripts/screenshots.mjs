/**
 * 사용자 관점 시나리오 자동 검증 v3 (390×844 폰 뷰포트). 단계별 스크린샷 → docs/screenshots, 결과 → docs/screenshots/results.json
 * 실행: npx expo export --platform web && npx serve dist -l 8081 -s  (다른 터미널)
 *      → OUT=docs/screenshots BASE=http://localhost:8081 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshots.mjs
 */
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'docs/screenshots';
const BASE = process.env.BASE ?? 'http://localhost:8081';
const STORE_KEY = 'wws-v3';
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
const enableDev = async () => { await go('/settings'); const on = await page.getByText('머리 위 편지 소환').first().isVisible().catch(() => false); if (!on) { await page.getByRole('switch').last().click(); await page.waitForTimeout(300); } await page.mouse.wheel(0, 900); await page.waitForTimeout(300); };
const spawnPassby = async () => { await enableDev(); await tap('머리 위 편지 소환'); await page.getByText('머리 위를 지나가요').first().waitFor({ state: 'visible', timeout: 25000 }); await page.waitForTimeout(500); };
const waitState = async (pred, timeout = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (pred(await state())) return; await page.waitForTimeout(1000); } throw new Error('waitState timeout'); };
const ffUntil = async (pred, maxHours) => { if (pred(await state())) return; await enableDev(); for (let i = 0; i < maxHours; i++) { await tap('1시간 빨리감기'); await page.waitForTimeout(1100); if (pred(await state())) return; } throw new Error(`ffUntil: not satisfied after ${maxHours}h`); };
const fastForward = async (hours) => { await enableDev(); for (let i = 0; i < hours; i++) { await tap('1시간 빨리감기'); await page.waitForTimeout(150); } await page.waitForTimeout(1200); };

// ── 1. 온보딩 ────────────────────────────────────────────
await step('01', '온보딩 · 첫 화면(워드마크·지구·기능 3줄)', async () => { await go('/'); await page.waitForTimeout(1200); await see('시작하기'); await shot('01-onboarding-welcome'); });
await step('02', '온보딩 · 프로필(아바타·닉네임·태그)', async () => {
  await tap('시작하기'); await page.getByPlaceholder('닉네임 (친구에게만 보여요)').fill('dan'); await page.getByPlaceholder('한 줄 소개').fill('밤에 더 살아있는 사람');
  await tap('디자인', { exact: true }); await tap('러닝', { exact: true }); await tap('커피', { exact: true }); await shot('02-onboarding-profile');
});
await step('03', '온보딩 · 위치 선택(지구 탭/도시 칩/내 위치 버튼)', async () => { await tap('다음', { exact: true }); await see('위치를 선택하세요'); await shot('03-onboarding-location'); await tap('🇰🇷 서울'); await page.waitForTimeout(900); await see('대한민국'); await shot('03b-onboarding-location-picked'); });
await step('04', '홈 · 국가 스토리 + 젠리 지구(경로 숨김·배달원 이동) + CTA', async () => { await tap('지구로 들어가기'); await page.waitForTimeout(2500); await see('편지 쓰기'); await see('배달원을 탭하면'); await shot('04-home'); await page.waitForTimeout(1500); await shot('04b-home-moving'); });

// ── 2. 탭 ────────────────────────────────────────────────
await step('05', '편지 탭 · 빈 상태(걷는 배달원 안내)', async () => { await go('/letters'); await see('아직 보낸 편지가 없어요'); await shot('05-letters-empty'); });
await step('06', '친구 탭 · 해금 진행 + 즉시 친구 안내', async () => { await go('/friends'); await see('다음 배달원'); await shot('06-friends-empty'); });
await step('07', '커뮤니티 · 엽서 피드(국가 없이 거리만 · 댓글)', async () => { await go('/community'); await see('km'); await see('댓글'); await shot('07-community-feed'); });
await step('08', '커뮤니티 · 사람(??? 카드·컨택%·⚡즉시 친구)', async () => { await tap('사람', { exact: true }); await see('컨택 가능성 높은 순'); await see('⚡'); await shot('08-community-people'); });
await step('09', '커뮤니티 · 랭킹', async () => { await tap('랭킹', { exact: true }); await see('(나)'); await shot('09-community-rank'); });
await step('10', '프로필 · 인스타 레이아웃 + 배달원 격납고(43종·가족별)', async () => { await go('/profile'); await see('배달원', 8000, true); await shot('10-profile'); await page.mouse.wheel(0, 700); await page.waitForTimeout(400); await shot('10b-profile-hangar'); });
await step('11', '상점 · 플랜 3종(엿보기/끌어오기/즉시 한도) + 아이템 8종', async () => { await go('/store'); await see('플러스'); await shot('11-store'); await page.mouse.wheel(0, 800); await page.waitForTimeout(400); await shot('11b-store-items'); });
await step('12', '설정 · 실제 권한 상태 + 테마(시스템/라이트/다크) + 백엔드 모드', async () => { await go('/settings'); await see('기기 권한'); await see('테마'); await shot('12-settings'); });

// ── 3. 첫 편지 ───────────────────────────────────────────
await step('13', '편지 쓰기 1 · 편지지 + 스토리 공유 옵션', async () => { await go('/compose'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('지금 이 편지를 읽는 당신, 오늘 하늘은 어떤 색인가요? 서울은 오렌지빛이에요.'); await shot('13-compose-text'); });
await step('14', '편지 쓰기 2 · 목적지(랜덤/직접/경유지)', async () => { await tap('다음', { exact: true }); await see('육지 어딘가'); await shot('14-compose-dest-random'); await tap('📍 직접'); await tap('🇯🇵 도쿄'); await page.waitForTimeout(900); await shot('14b-compose-dest-pick'); });
await step('15', '편지 쓰기 3 · 배달원 가족 칩 + 카드(커스텀 아이콘) · 방어권 · 조건', async () => { await tap('다음', { exact: true }); await see('느린 것부터 빠른 것까지'); await shot('15-compose-vehicle'); await page.mouse.wheel(0, 700); await page.waitForTimeout(400); await shot('15b-compose-conditions'); });
await step('16', '발송 → 출발 → 홈 포커스(내 편지만 경로 표시) → 새로고침 시 경로 숨김', async () => {
  await tap('보내기', { exact: true }); await page.waitForTimeout(500); await shot('16-launch'); await page.waitForTimeout(2300); await see('자세히'); await see('내 편지'); await shot('16b-home-focus-route');
  await go('/'); await page.waitForTimeout(1500); await see('배달원을 탭하면'); await shot('16c-home-routes-hidden');
});

// ── 4. 머리 위 통과 → 엿보기/끌어오기/경로/잡기 ──────────
await step('17', '개발자 모드 · 편지 소환 → 홈 통과 배너', async () => { await enableDev(); await see('머리 위 편지 소환'); await shot('17-settings-dev'); await spawnPassby(); await shot('17b-home-passby'); });
await step('18', '잡기 화면 · 타이머 · 엿보기/끌어오기/경로/달팽이/되돌리기/바다/우주', async () => { await tap('보기', { exact: true }); await page.waitForTimeout(900); await see('엿보기', 8000, true); await see('끌어오기', 8000, true); await see('경로 바꾸기', 8000, true); await shot('18-catch'); });
await step('18b', '무료 · 첫 엿보기 렌즈 1개로 미리보기 → 끌어오기는 한도 없음 → 상점 안내', async () => {
  await tap('엿보기', { exact: true }); await see('엿봤어요'); await page.waitForTimeout(1500); await see('엿본 내용'); await shot('18b-catch-peeked-free');
  await tap('끌어오기', { exact: true }); await see('한도를 다 썼어요'); await shot('18c-catch-pull-quota'); await page.waitForTimeout(1600); await see('플랜', 8000, true);
});
await step('19', '경로 바꾸기 · 경유지 1개 찍고 적용(무료 플랜 한도 1)', async () => {
  await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(800);
  await tap('경로 바꾸기'); await see('경유지 0/1'); await tap('🇯🇵 도쿄'); await page.waitForTimeout(600); await shot('19-catch-reroute');
  await tap('경로 적용'); await page.waitForTimeout(600); await shot('19b-reroute-result'); await page.waitForTimeout(1600);
});
await step('20', '소환 → 잡기 → 편지 공개(봉투) + 보낸 사람 실제 프로필 + 공유 버튼', async () => {
  await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(800);
  await page.getByText('잡기', { exact: true }).last().click(); await page.waitForTimeout(700); await shot('20-catch-result'); await page.waitForTimeout(1300);
  await see('답장을 보내'); await see('프로필 · 엽서 보기'); await page.getByLabel('공유').first().waitFor({ state: 'visible' }); await shot('20b-letter-revealed');
  await page.mouse.wheel(0, 500); await page.waitForTimeout(400); await shot('20c-letter-sender-profile');
});
await step('20d', '보낸 사람 프로필 열기(소개·태그·엽서) — ??? 아님', async () => { await tap('프로필 · 엽서 보기'); await page.waitForTimeout(700); await see('편지 보내기'); const nm = await page.locator('text=???').count(); await shot('20d-sender-profile'); return nm === 0 ? '??? 없음' : `??? ${nm}곳`; });

// ── 5. 왕복(답장 → 수락 편지 → 확정) → 실시간 채팅 ──────
await step('21', '답장 편지 쓰기(친구 요청 포함)', async () => {
  await page.goBack(); await page.waitForTimeout(600); await tap('답장 편지 쓰기'); await page.getByPlaceholder('편지 잘 받았어요…').fill('편지 잘 받았어요! 서울에서 잡았어요. 친구 해요 🙌'); await shot('21-reply-compose');
  await tap('다음', { exact: true }); await see('느린 것부터 빠른 것까지'); await tap('다음', { exact: true }); await see('친구 요청 포함'); await shot('21b-reply-confirm'); await tap('보내기', { exact: true }); await page.waitForTimeout(2800);
});
await step('22', '친구 탭 "왕복 진행 중" + 채팅 잠김(확정 전엔 편지로만)', async () => {
  await go('/friends'); await see('왕복 진행 중'); await shot('22-friends-pending');
  const s = await state(); const otherId = s.letters.find((l) => l.senderId === 'me' && l.kind === 'reply')?.recipientId;
  await go(`/chat/${otherId}`); await see('편지로만'); await shot('22b-chat-locked');
});
await step('23', '봇 답장 소환 → 우편함 "답장" 도착 → 수락(수락 편지 출발)', async () => {
  await enableDev(); await tap('답장 편지 소환'); await page.waitForTimeout(500);
  await page.getByText('수락 · 수락 편지 보내기').first().waitFor({ state: 'visible', timeout: 150000 }); await shot('23-letters-reply-inbox');
  await tap('수락 · 수락 편지 보내기'); await page.waitForTimeout(1200); await see('내 편지'); await shot('23b-home-accept-letter');
});
await step('24', '빨리감기 → 수락 편지 도착 → 상대 확정 → 친구 1명 (왕복 A)', async () => {
  await fastForward(8); await go('/friends'); await page.getByText('메시지', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 }); await shot('24-friends-first');
});
await step('25', '내 답장이 도착 → 상대 수락 편지가 내게 옴 → "확정하고 채팅 시작" (왕복 B)', async () => {
  const myReply = (s) => s.letters.find((l) => l.senderId === 'me' && l.kind === 'reply');
  await ffUntil((s) => myReply(s)?.status !== 'flying', 40); // 걷는 답장이 도착할 때까지 빨리감기
  const r0 = myReply(await state()); if (r0?.status === 'declined') throw new Error('bot declined the reply (10% chance) — rerun');
  await waitState((s) => s.letters.some((l) => l.kind === 'accept' && l.recipientId === 'me') || myReply(s)?.status === 'declined', 60000); // 봇 수락(10~40초)
  await ffUntil((s) => s.letters.some((l) => l.kind === 'accept' && l.recipientId === 'me' && l.status !== 'flying'), 12); // 수락 편지(항공) 도착
  await go('/letters'); await page.getByText('확정하고 채팅 시작').first().waitFor({ state: 'visible', timeout: 30000 }); await shot('25-letters-accept-inbox');
  await tap('확정하고 채팅 시작'); await page.waitForTimeout(900); await see('친구 · 실시간'); await shot('25b-chat-open');
});
await step('26', '실시간 채팅 · 보내기 → 봇 응답', async () => {
  await page.getByPlaceholder('메시지 보내기…').fill('안녕! 드디어 실시간이네 ✈️'); await tap('보내기', { exact: true }); await page.waitForTimeout(400); await shot('26-chat-sent');
  await page.waitForTimeout(10000); await shot('26b-chat-reply');
});
await step('27', '친구 탭 · 친구 2명(닉네임 공개) + 홈 친구 버블', async () => { await go('/friends'); await see('메시지', 8000, true); await shot('27-friends-list'); await go('/'); await page.waitForTimeout(1500); await shot('27b-home-with-friends'); });
await step('28', '활동(알림) 목록', async () => { await go('/notifications'); await see('활동'); await shot('28-activity'); });

// ── 6. 커뮤니티 · 스토리 · 엽서 · 댓글 · 즉시 친구 ──────
await step('29', '내 편지를 엽서로 공개(+스토리) → 피드에 거리만 → 홈 스토리 "내 나라"', async () => {
  const s = await state(); const mine = s.letters.find((l) => l.senderId === 'me' && l.kind === 'letter');
  await go(`/letter/${mine.id}`); await tap('커뮤니티에 엽서로 공개'); await page.waitForTimeout(600); await shot('29-letter-published');
  await go('/community'); await see('dan'); await shot('29b-community-my-post'); await go('/'); await page.waitForTimeout(1200); await see('내 나라'); await shot('29c-home-story-mine');
});
await step('30', '홈 스토리 "어딘가" 탭 → 엽서 상세에서만 국가 공개 + 댓글 달기', async () => {
  await tap('어딘가', { exact: true }); await page.waitForTimeout(800); await see('댓글'); await shot('30-post-detail');
  await page.getByPlaceholder('댓글 달기…').fill('사진 너무 좋아요. 그곳의 밤은 어때요?'); await tap('게시', { exact: true }); await page.waitForTimeout(500); await see('사진 너무 좋아요'); await shot('30b-post-comment');
});
await step('31', '⚡ 즉시 친구(결제) · 코인으로 즉시 친구권 구매 → 요청 → 봇 응답(수락/거절 환불)', async () => {
  await enableDev(); await tap('+100 코인'); await tap('+100 코인'); await tap('+100 코인');
  await go('/store'); await tap('🪙 300', { exact: true }); await see('코인 구매 완료'); await shot('31-store-instant-bought');
  await go('/community'); await tap('사람', { exact: true }); await page.getByText('⚡', { exact: true }).first().click(); await page.waitForTimeout(700); await see('⚡ 즉시 친구', 8000, true); await shot('31b-user-instant');
  await tap('₩3,900', { exact: true }); await see('즉시 친구를 요청했어요'); await shot('31c-user-instant-requested');
  await go('/friends'); await shot('31d-friends-after-instant'); // 봇이 8~30초 안에 응답 → 대기 중이거나 이미 친구
  await go('/notifications'); await page.getByText(/친구가 됐어요|환불/).first().waitFor({ state: 'visible', timeout: 45000 }); await shot('31e-instant-answered');
  const s = await state(); const r = s.instantRequests[0]; return r ? `${r.status}` : 'no-request';
});

// ── 7. 유료 플랜 · 엿보기/끌어오기 · 바다 ────────────────
await step('32', '상점 · 테스트 결제(플러스) → 엿보기 3/일 · 끌어오기 1/일 · 경유지 2', async () => {
  await go('/store'); page.once('dialog', (d) => d.accept()); await tap('플러스 시작'); await page.waitForTimeout(800); await see('플러스 시작!'); await shot('32-store-plus');
  await go('/compose'); await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('플러스 테스트'); await tap('다음', { exact: true }); await see('경유지 (2)'); await shot('32b-compose-plus-waypoints');
});
await step('33', '플러스 · 엿보기(내용 미리보기) → 마음에 들면 끌어오기(1회) → 내 위치로 방향 전환', async () => {
  await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(800); await see('남은 3회');
  await tap('엿보기', { exact: true }); await see('엿봤어요'); await page.waitForTimeout(1500); await shot('33-catch-peeked');
  await tap('끌어오기', { exact: true }); await see('끌어왔어요'); await shot('33b-catch-pulled'); await page.waitForTimeout(1600);
  await see('내게 오는 편지', 8000); await shot('33c-home-pulled-incoming');
  const s = await state(); const pulled = s.letters.find((l) => l.pulledBy === 'me'); return pulled ? `pulls=${pulled.pulls}, dest=${pulled.destination.city}` : 'not-pulled';
});
await step('34', '바다에 빠뜨리기 → 몇 시간 정지(주인은 건져내기 가능) → 지구에 가라앉은 표시', async () => {
  // 방어권·면역(돌고래/잠수함)에 막히면 다른 편지로 최대 3회 재시도
  let outcome = '';
  for (let i = 0; i < 3 && outcome !== 'sunk'; i++) {
    await spawnPassby(); await tap('보기', { exact: true }); await page.waitForTimeout(800); await tap('바다에', { exact: true });
    const t = await page.getByText(/풍덩|튕겨나갔어요|건드릴 수 없어요/).first().textContent({ timeout: 8000 });
    outcome = t.includes('풍덩') ? 'sunk' : t.includes('튕겨') ? 'defended' : 'immune';
    await shot(outcome === 'sunk' ? '34-catch-sunk' : `34-catch-${outcome}-${i}`); await page.waitForTimeout(1800);
  }
  const s = await state(); const sunk = s.letters.find((l) => l.status === 'sunk'); if (!sunk) throw new Error(`no sunk letter (last outcome ${outcome})`); await shot('34b-home-sunk'); return `sunkUntil in ${Math.round((sunk.sunkUntil - Date.now()) / 1000)}s`;
});

// ── 8. 다크 모드 ─────────────────────────────────────────
await step('35', '다크 모드 · 설정에서 전환 → 홈/커뮤니티/편지/프로필/상점/잡기', async () => {
  await go('/settings'); await tap('다크', { exact: true }); await page.waitForTimeout(500); await shot('35-dark-settings');
  await go('/'); await page.waitForTimeout(1500); await shot('35b-dark-home');
  await go('/community'); await see('km'); await shot('35c-dark-community');
  await go('/letters'); await page.waitForTimeout(600); await shot('35d-dark-letters');
  await go('/profile'); await page.waitForTimeout(600); await shot('35e-dark-profile');
  await go('/store'); await page.waitForTimeout(600); await shot('35f-dark-store');
  await spawnPassby(); await shot('35g-dark-home-passby'); await tap('보기', { exact: true }); await page.waitForTimeout(900); await shot('35h-dark-catch'); await tap('그냥 보내주기');
  const s = await state(); return `theme=${s.settings.theme}`;
});

// ── 9. 통과 신뢰성 ───────────────────────────────────────
const rel = [];
for (let i = 0; i < 3; i++) {
  try { await spawnPassby(); rel.push('ok'); await tap('보기', { exact: true }); await page.waitForTimeout(700); await tap(i % 2 ? '우주로' : '달팽이', { exact: true }); await page.waitForTimeout(2200); } catch { rel.push('miss'); }
}
results.push({ id: '36', title: `통과 알림 신뢰성 3회 (${rel.join(', ')})`, ok: rel.every((x) => x === 'ok') });
console.log('passby reliability:', rel.join(', '));
await go('/settings'); await tap('시스템', { exact: true }).catch(() => {});

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
console.log(`done: ${results.filter((r) => r.ok).length}/${results.length} ok, console errors: ${errors.length}`);
await browser.close();
