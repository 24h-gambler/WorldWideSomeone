# WorldWideSomeone 🌍✈️

> 전 세계 누군가에게 편지를 날리고, 머리 위를 지나는 편지를 잡거나 엿보고 끌어오고, **왕복 편지가 끝나야** 친구가 되어 실시간으로 대화하는 앱.
> **결제를 많이 하거나, 친구를 많이 만들거나** — 두 갈래로 성장하는 게임.

| 홈 (젠리 지구 · 경로 숨김 · 국가 스토리) | 잡기 · 엿보기 · 끌어오기 | 받은 편지 (보낸 사람 공개 · 공유) | 다크 모드 |
|---|---|---|---|
| ![](docs/screenshots/04-home.png) | ![](docs/screenshots/18-catch.png) | ![](docs/screenshots/20b-letter-revealed.png) | ![](docs/screenshots/35b-dark-home.png) |

## 문서
- [`docs/DESIGN.md`](docs/DESIGN.md) — 하나의 흐름, 레퍼런스(인스타·젠리) 반영표, 배달원 43종 카탈로그, 엿보기/끌어오기/바다 규칙, 요금제, 커뮤니티 프라이버시, 데이터 모델
- [`docs/ECONOMY.md`](docs/ECONOMY.md) — 엿보기·끌어오기·즉시 친구 한도와 가격을 정한 계산
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — 단계별 · 사용자 관점 검증 리포트(자동 주행 스크린샷 증거) + 실기기/서버 체크리스트
- [`docs/LAUNCH.md`](docs/LAUNCH.md) — Firebase/GCP · EAS 빌드 · RevenueCat 결제 · 스토어 제출

## 흐름
```
쓰기 → 배달원이 들고 감(🚶 사람 → 새·동물·차·기차·배·비행기·로켓, 43종 · 친구 수로 해금 · 지구 위를 실시간 이동)
   → 누군가의 머리 위 → 알림 → 잡기 | 🔍 엿보기(유료 한도) → 🧲 끌어오기(편지당 1회) | 경로 바꾸기(경유지 1·2·3) | 🐌 | 되돌리기 | 🌊 바다(몇 시간 정지 · 주인이 건져냄) | 우주
   → 읽기(보낸 사람 프로필 공개 · 이미지로 공유) → 답장 → 상대가 수락(수락 편지 출발) → 내가 확정 → 친구 + 실시간 채팅   (확정 전엔 편지로만)
   커뮤니티: 국가 없이 거리만 · 댓글 · 국가 스토리(탭해야 공개) · ⚡ 즉시 친구(결제)
```

## 실행

### 폰에서 (Expo Go · 로컬 시뮬 모드)
```bash
npm install
npx expo start          # Expo Go 로 QR 스캔 (같은 Wi-Fi, 안 되면 --tunnel)
```
Firebase 환경변수가 없으면 봇 60명이 세계를 돌리는 **로컬 시뮬**로 전체 루프를 체험할 수 있다. 설정 → 개발자 모드에서 배속·빨리감기·편지 소환·답장 소환·코인.

### 실서비스 (Firebase + dev build)
```bash
cp .env.example .env    # Firebase 웹 앱 구성값 입력
cd functions && npm install && npm run build && cd ..
firebase deploy         # rules · indexes · functions(tickWorld 스케줄러 포함)
eas build --profile development --platform android|ios
```
자세한 절차·체크리스트는 [`docs/LAUNCH.md`](docs/LAUNCH.md).

### 검증
```bash
npm run typecheck && npm run functions:build
npm run export:web && npx serve dist -l 8081 -s      # 터미널 1
BASE=http://localhost:8081 CHROMIUM_PATH=/opt/pw-browsers/chromium npm run shots && npm run report   # 터미널 2
```

## 구조
```
src/app/            expo-router 화면 (onboarding · (tabs) · compose · catch · letter · post · chat · user · store · settings · notifications)
src/components/     ui(인스타 키트 · 라이트/다크) · globe(젠리 지구) · vehicle-art(배달원 43종 SVG) · item-art(아이템/행동 아이콘) · postcard-thumb(엽서 풍경) · letter-card
src/engine/         geo(대권·육지 판정·격자) · sim(경로·궤적·벌칙·경로변경·끌어오기·침수/재부상·통과 판정) · notify · haptics
src/store/          zustand + AsyncStorage · 게임 액션(엿보기·끌어오기·수락·확정·즉시 친구·댓글) · 로컬 봇 스케줄러
src/services/       firebase · sync(구독/콜러블) · location(GPS·백그라운드) · push · purchases(Mock/RevenueCat) · background
src/data/           vehicles(배달원) · plans(요금제·상품·한도) · cities · bots · profile
src/theme/          라이트/다크 팔레트 · ThemeProvider · useColors/useStyles
functions/          Cloud Functions (tickWorld · sendLetter · catchLetter · redirectLetter(peek/pull/…) · rescueLetter · approveReply · requestInstantFriend · commentPost · revenuecatWebhook)
firestore.rules · storage.rules · firestore.indexes.json · firebase.json · eas.json · metro.config.js
scripts/            screenshots(시나리오 자동 주행 38단계) · verification-report · make-icons
```
