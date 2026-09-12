# 런칭 가이드 — Firebase · Google Cloud · EAS · RevenueCat · 스토어

이 저장소는 **로컬 시뮬(Expo Go)** 과 **실서비스(Firebase + dev build)** 두 모드를 같은 화면으로 지원한다.
아래 순서대로 진행하면 실제 사용자끼리 편지를 주고받는 서비스가 된다. 계정이 필요한 단계는 사용자 본인이 수행해야 한다.

## 0. 준비물
- Google 계정(Firebase/GCP), Apple Developer(₩129,000/년), Google Play Console(US$25), RevenueCat 계정(무료), Expo 계정(EAS)

## 1. Firebase 프로젝트 (Google Cloud)
1. https://console.firebase.google.com → 프로젝트 생성 (예: `worldwidesomeone`) → **Blaze 요금제**(Cloud Functions·Scheduler 필요, 소규모는 무료 한도 내)
2. **Authentication** → 로그인 방법 → 익명 사용 (추후 Apple/Google 추가)
3. **Firestore** → 데이터베이스 만들기 → 위치 `asia-northeast3`(서울) → 프로덕션 모드
4. **Storage** 사용 (편지 이미지)
5. 프로젝트 설정 → 웹 앱 추가 → 구성값을 `.env` 에 복사:
   ```
   cp .env.example .env   # EXPO_PUBLIC_FIREBASE_* 채우기
   ```
6. CLI:
   ```bash
   npm i -g firebase-tools && firebase login
   sed -i 's/your-firebase-project-id/<PROJECT_ID>/' .firebaserc
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
7. Cloud Functions:
   ```bash
   cd functions && npm install && cd ..
   firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET   # 임의의 긴 문자열
   firebase deploy --only functions
   ```
   - `tickWorld` 가 Cloud Scheduler 잡을 자동 생성(매 분). GCP 콘솔 → Cloud Scheduler 에서 확인.
   - 로그: `firebase functions:log`
8. (선택) 에뮬레이터로 로컬 테스트: `firebase emulators:start` → `src/services/firebase.ts` 에서 `connectFirestoreEmulator` 를 추가하면 됨.

## 2. Expo / EAS (실기기 빌드)
Expo Go 는 원격 푸시(Android)·백그라운드 위치·RevenueCat 을 지원하지 않는다 → **development build** 로 전환.
```bash
npm i -g eas-cli && eas login
eas init                       # app.json 에 extra.eas.projectId 기록 → 푸시 토큰에 필요
eas build --profile development --platform android   # 또는 ios (Apple 계정 필요)
```
- `app.json` 의 `ios.bundleIdentifier` / `android.package` 를 실제 값으로 바꾼다.
- 백그라운드 위치(iOS): `app.json` → `ios.infoPlist.UIBackgroundModes` 에 `"location"` 추가, `expo-location` 플러그인 `isIosBackgroundLocationEnabled: true`, `isAndroidBackgroundLocationEnabled: true`.
- 푸시: `expo-notifications` 는 Expo Push Service 를 사용. iOS 는 EAS 가 APNs 키를 생성/관리, Android 는 FCM V1 서비스 계정 JSON 을 `eas credentials` 로 업로드.

## 3. RevenueCat (결제)
1. https://app.revenuecat.com → 프로젝트 → iOS/Android 앱 추가 → 스토어 자격증명 연결
2. 상품 생성 (App Store Connect / Play Console 에서 먼저 만든 뒤 RevenueCat 에 등록). ID 는 `src/data/plans.ts` 와 동일:
   - 구독: `wws_plus_monthly`(₩4,900), `wws_pro_monthly`(₩9,900)
   - 소모품: `wws_shield_5`, `wws_ufo_1`, `wws_orbit_1`, `wws_coins_300`, `wws_coins_1000`
3. Entitlements: `plus`, `pro` → Offering `default` 에 패키지 연결
4. 앱: `npx expo install react-native-purchases` → `.env` 에 `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY` → dev build 재빌드. `src/services/purchases.ts` 가 자동으로 RevenueCat 어댑터를 사용.
5. 웹훅: RevenueCat → Integrations → Webhooks → URL `https://asia-northeast3-<PROJECT>.cloudfunctions.net/revenuecatWebhook`, Authorization `Bearer <REVENUECAT_WEBHOOK_SECRET>` → 서버가 플랜/아이템을 지급.
6. RevenueCat 의 `appUserID` 는 Firebase `uid` 를 쓴다(`purchases.init(uid)`).

## 4. 스토어 제출
```bash
eas build --profile production --platform all
eas submit --platform ios      # eas.json submit.production 값 채우기
eas submit --platform android
```
체크리스트
- [ ] 개인정보 처리방침 URL (위치·이미지·익명 ID 수집 명시, 50km/10km 격자 저장 설명)
- [ ] App Store "위치 항상 허용" 사유 문구(`app.json` 플러그인 문자열) · 백그라운드 모드 심사 메모
- [ ] Play Console: 위치 권한 선언 + 백그라운드 위치 영상, 데이터 보안 섹션
- [ ] 연령 등급(12+ · 익명 채팅), 신고/차단(`reports` 컬렉션 + Functions 모더레이션 추가 예정)
- [ ] 스크린샷(6.7"/6.5"/5.5", Android 폰) — `docs/screenshots` 재활용

## 5. 운영 파라미터 (functions/src)
| 항목 | 값 | 위치 |
|---|---|---|
| 시간 배속 | 60 (걷기 5km/h → 실제 300km/h) | `index.ts` TIME_SCALE |
| 통과 반경 | 150km | `sim.ts` PASSBY_RADIUS_KM |
| 잡기 창 | 10분 × 배달원 계수 | `sim.ts` catchWindowMs |
| 착륙 후 집어가기 | 24시간 | `sim.ts` LANDED_WINDOW_MS |
| 달팽이 | 30분 · ×0.1 | `sim.ts` SNAIL |
| 틱 주기 | 1분 (Cloud Scheduler) | `index.ts` tickWorld |

## 6. 비용 감 (초기 1만 MAU 가정)
- Firestore 읽기: 틱당 flying 편지 ≤ 500 + 통과 후보 조회 → 월 수천만 읽기 이내 → 수만 원대
- Functions: 매 분 1회 + 콜러블 → 무료 한도 근접
- Expo Push: 무료
