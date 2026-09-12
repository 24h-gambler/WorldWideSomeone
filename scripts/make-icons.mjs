// 앱 아이콘/스플래시/파비콘 생성: HTML+SVG를 Chromium으로 렌더해 PNG로 저장
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'assets/images';
fs.mkdirSync(OUT, { recursive: true });

const globe = (size, { bg = true, mono = false, pad = 0 } = {}) => `
<html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DDEEFF"/></linearGradient>
    <radialGradient id="ocean" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="#E3F4FF"/><stop offset="0.6" stop-color="#BFE3FF"/><stop offset="1" stop-color="#86C6FF"/></radialGradient>
    <radialGradient id="atmo" cx="50%" cy="50%" r="50%"><stop offset="0.8" stop-color="#7DBBFF" stop-opacity="0"/><stop offset="0.9" stop-color="#7DBBFF" stop-opacity="0.5"/><stop offset="1" stop-color="#7DBBFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D2F5C4"/><stop offset="1" stop-color="#8ADB97"/></linearGradient>
    <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset="0.35" stop-color="#FA7E1E"/><stop offset="0.7" stop-color="#D62976"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient>
    <radialGradient id="rim" cx="42%" cy="36%" r="68%"><stop offset="0.75" stop-color="#1B5FBF" stop-opacity="0"/><stop offset="1" stop-color="#1B5FBF" stop-opacity="0.3"/></radialGradient>
  </defs>
  ${bg ? `<rect width="1024" height="1024" rx="224" fill="url(#bg)"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${(1024 - 2 * pad) / 1024})">
  ${mono ? `
    <circle cx="512" cy="540" r="330" fill="#fff"/>
    <path d="M150 470 C 300 250, 700 250, 900 430" stroke="#fff" stroke-width="44" fill="none" stroke-linecap="round"/>
    <path d="M905 430 l-70 -8 l40 60 z" fill="#fff"/>
  ` : `
    <circle cx="512" cy="540" r="400" fill="url(#atmo)"/>
    <circle cx="512" cy="540" r="330" fill="url(#ocean)"/>
    <g fill="url(#land)" opacity="0.95">
      <path d="M330 330 c60 -40 140 -30 180 10 c30 30 10 70 -20 90 c-40 30 -110 20 -150 -10 c-30 -25 -40 -65 -10 -90z"/>
      <path d="M560 370 c50 -20 120 0 150 40 c30 40 10 100 -30 120 c-50 25 -120 5 -150 -40 c-25 -40 -10 -100 30 -120z"/>
      <path d="M300 520 c40 -20 90 0 100 40 c10 50 -20 110 -60 130 c-40 20 -90 0 -100 -50 c-10 -50 20 -100 60 -120z"/>
      <path d="M520 600 c70 -30 170 -10 200 50 c30 60 -10 130 -80 150 c-70 20 -150 -10 -170 -70 c-20 -50 0 -110 50 -130z"/>
      <path d="M420 760 c30 -15 70 -5 80 25 c10 30 -15 60 -45 65 c-35 5 -65 -20 -60 -50 c3 -20 10 -32 25 -40z"/>
    </g>
    <circle cx="512" cy="540" r="330" fill="url(#rim)"/>
    <circle cx="512" cy="540" r="330" fill="none" stroke="#fff" stroke-width="10"/>
    <path d="M150 470 C 300 250, 700 250, 900 430" stroke="url(#arc)" stroke-width="34" fill="none" stroke-linecap="round"/>
    <circle cx="150" cy="470" r="26" fill="#fff"/><circle cx="150" cy="470" r="16" fill="#0095F6"/>
    <circle cx="900" cy="430" r="58" fill="#fff"/><circle cx="900" cy="430" r="50" fill="#fff" stroke="#D62976" stroke-width="8"/><text x="900" y="452" font-size="60" text-anchor="middle">🚶</text>
  `}
  </g>
</svg></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const render = async (file, html, size, omit = false) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: omit, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('🎨', file);
};
await render('icon.png', globe(1024), 1024);
await render('android-icon-foreground.png', globe(1024, { bg: false, pad: 160 }), 1024, true);
await render('android-icon-monochrome.png', globe(1024, { bg: false, mono: true, pad: 160 }), 1024, true);
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent('<html><body style="margin:0;background:#DDEEFF"></body></html>');
await page.screenshot({ path: `${OUT}/android-icon-background.png` });
await render('splash-icon.png', globe(512, { bg: false, pad: 40 }), 512, true);
await render('favicon.png', globe(96), 96);
await browser.close();
