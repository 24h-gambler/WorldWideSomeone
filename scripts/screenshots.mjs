import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'docs/screenshots';
const BASE = 'http://localhost:8080';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', hasTouch: true, isMobile: true, permissions: [] });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('📸', name); };
const tapText = async (text, nth = 0, exact = false) => { const loc = page.getByText(text, { exact }).nth(nth); await loc.waitFor({ state: 'visible', timeout: 8000 }); await loc.click(); };

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('01-onboarding-welcome');
await tapText('시작하기');
await page.waitForTimeout(300);
await page.getByPlaceholder('예: moonwalker').fill('dan');
await page.getByPlaceholder('오늘도 하늘을 봅니다').fill('밤에 더 살아있는 사람');
await tapText('디자인', 0, true);
await tapText('러닝', 0, true); await tapText('커피', 0, true); await tapText('사진', 0, true);
await shot('02-onboarding-profile');
await tapText('다음');
await page.waitForTimeout(600);
await shot('03-onboarding-location');
await tapText('🇰🇷 서울');
await page.waitForTimeout(800);
await shot('03b-onboarding-location-picked');
await tapText('지구로 들어가기');
await page.waitForTimeout(2500);
await shot('04-home-globe');

// tabs
for (const [path, name] of [['/letters', '05-letters'], ['/friends', '06-friends'], ['/community', '07-community'], ['/profile', '08-profile']]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); await shot(name);
}
await page.goto(BASE + '/store', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await shot('09-store');
await page.goto(BASE + '/notifications', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await shot('10-notifications');

// compose flow
await page.goto(BASE + '/compose', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.getByPlaceholder('지금 이 편지를 읽는 당신에게…').fill('지금 이 편지를 읽는 당신, 오늘 하늘은 어떤 색인가요? 서울은 오렌지빛이에요.');
await shot('11-compose-1-text');
await tapText('다음'); await page.waitForTimeout(600);
await shot('12-compose-2-dest-random');
await tapText('📍 직접 찍기'); await page.waitForTimeout(500);
await tapText('🇯🇵 도쿄'); await page.waitForTimeout(1200);
await shot('12b-compose-2-dest-pick');
await tapText('다음'); await page.waitForTimeout(600);
await shot('13-compose-3-vehicle');
await page.mouse.wheel(0, 900); await page.waitForTimeout(500);
await shot('13b-compose-3-conditions');
await tapText('날리기'); await page.waitForTimeout(500);
await shot('14-launch');
await page.waitForTimeout(2200);
await shot('15-home-after-send');

// settings → dev mode → spawn passby
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await shot('16-settings');
const switches = page.getByRole('switch');
await switches.nth(2).click(); await page.waitForTimeout(400);
await page.mouse.wheel(0, 600); await page.waitForTimeout(300);
await shot('16b-settings-dev');
await tapText('머리 위 편지 소환');
await page.getByText('잡기', { exact: true }).first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
await page.waitForTimeout(800);
await shot('17-home-passby-banner');
try {
  await tapText('잡기', 0); await page.waitForTimeout(900);
  await shot('18-catch');
  await tapText('🫳 잡기'); await page.waitForTimeout(700);
  await shot('19-catch-result');
  await page.waitForTimeout(1200);
  await shot('20-letter-revealed');
  await page.mouse.wheel(0, 500); await page.waitForTimeout(300);
  await shot('20b-letter-bottom');
  await tapText('친구 요청 보내기'); await page.waitForTimeout(800);
  await shot('21-chat');
  await page.getByPlaceholder('메시지 보내기').fill('안녕! 서울에서 잡았어 ✈️');
  await tapText('전송'); await page.waitForTimeout(400);
  await shot('21b-chat-sent');
} catch (e) { console.log('catch flow failed:', e.message.slice(0, 200)); await shot('18-catch-fail'); }

await page.goto(BASE + '/friends', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await shot('22-friends-after');
await page.goto(BASE + '/letters', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await shot('23-letters-after');

// 머리 위 통과 신뢰성 체크: 소환 → 배너 등장 → 처리(잡기/바다) 를 반복
const passbyResults = [];
for (let i = 0; i < 4; i++) {
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.mouse.wheel(0, 600); await page.waitForTimeout(200);
  try {
    await tapText('머리 위 편지 소환');
    await page.getByText('잡기', { exact: true }).first().waitFor({ state: 'visible', timeout: 25000 });
    passbyResults.push('ok');
    await tapText('잡기', 0, true); await page.waitForTimeout(700);
    if (i % 2 === 0) { await tapText('바다에'); } else { await tapText('되돌리기'); }
    await page.waitForTimeout(2200);
  } catch (e) { passbyResults.push('miss'); }
}
console.log('passby reliability:', passbyResults.join(', '));
fs.writeFileSync(`${OUT}/console.log`, errors.join('\n'));
console.log('errors:', errors.length);
await browser.close();
