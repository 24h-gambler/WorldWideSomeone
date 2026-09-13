# WorldWideSomeone — 클로드 작업 지침 (한 파일)

이 저장소에서 작업하는 모든 Claude 세션은 이 파일을 먼저 읽는다. 브랜치: `dan/nice-ritchie-0i2t4r` (다른 브랜치에 푸시 금지). 커밋 작성자: `dan <worldwidesomething25@gmail.com>`.

## 1. 무엇을 만드는가
Expo(React Native) 앱. 편지를 배달원(43종)이 지구 위로 실어 나르고, 머리 위를 지나면 잡고, 답장이 돌아오면(왕복) 친구가 되어 실시간 채팅. 규칙은 `docs/DESIGN.md`(v4)가 정본, 경제는 `docs/ECONOMY.md`, 대규모 파이프라인은 `docs/SCALE.md`, 배포는 `docs/LAUNCH.md`, 검증은 `docs/VERIFICATION.md`.

지켜야 할 제품 규칙(바꾸려면 사용자에게 먼저 묻는다):
- 원화(₩)는 상점의 코인 팩·플랜에서만. 나머지 가격은 전부 썸원코인(SC).
- 도착 예상 시간은 어디에도 표시하지 않는다(속도 km/h · 거리 km 만).
- 친구는 왕복(내 편지 → 상대 답장 → 수락)으로만. 직행 편지는 환불 없음.
- 비회원으로 시작. 가입(Google·Kakao 만, Apple 없음)은 보내기·좋아요·댓글·채팅·결제 순간에만.
- 착륙한 편지는 남에게 보이지 않는다. 되돌리기 기능은 없다. 바다는 "침수".
- SNS 에는 받은 편지 수만(보낸 수 표시 금지).

## 2. 계정 · 키 · 서비스 (무엇이 어디에 있나)

| 서비스 | 용도 | 값 / 위치 | 누가 하나 |
|---|---|---|---|
| **Supabase** 프로젝트 `ppyuaezzdndvphsindug` | DB · Auth · Realtime · Edge Functions · cron | URL `https://ppyuaezzdndvphsindug.supabase.co` · anon key(공개용)는 `.env.local` (git 제외) | 프로젝트는 생성됨(사용자). 스키마/함수 배포는 아래 3절 |
| Supabase **service_role key** | Edge Function 호출(cron) · 서버 전용 | 대시보드 → Settings → API. **저장소에 절대 커밋 금지**. `supabase secrets` 와 cron 등록에만 사용 | 사용자(대시보드) |
| Supabase **DB 비밀번호 / 액세스 토큰** | `supabase link`, `db push` | `supabase login`(브라우저) 또는 `SUPABASE_ACCESS_TOKEN` 환경변수 | 사용자 |
| **Google Cloud** OAuth 클라이언트 | Google 로그인 | console.cloud.google.com → APIs → Credentials → OAuth 2.0 Client (Web) · 승인된 리디렉션 URI: `https://ppyuaezzdndvphsindug.supabase.co/auth/v1/callback` → client id/secret 을 Supabase Auth → Providers → Google 에 입력 | 사용자 |
| **Kakao Developers** 앱 | 카카오 로그인 | developers.kakao.com → 앱 생성 → 카카오 로그인 활성화 · Redirect URI 위와 동일 · REST API 키/Client Secret 을 Supabase Auth → Providers → Kakao 에 입력 · 동의항목: 닉네임·프로필 이미지·이메일 | 사용자 |
| **Firebase** (2id.kimdan) | Android 푸시(FCM V1)만 | console.firebase.google.com → 프로젝트 → 서비스 계정 → 비공개 키(json) → `eas credentials` 에 업로드. Firestore/Functions 는 쓰지 않는다 | 사용자 |
| **Expo / EAS** | 빌드 · 푸시 토큰 | `eas login` · `app.json` 의 `extra.eas.projectId` · iOS APNs 키는 EAS 가 생성 | 사용자(로그인) → Claude(빌드 명령) |
| **RevenueCat** | 코인 팩·플랜 결제 | 앱 생성 → 스토어 상품 `wws_sc_300/800/2000/5500/12000`, `wws_plus_monthly`, `wws_pro_monthly` → 키를 `.env.local` 의 `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` → 웹훅 URL `https://ppyuaezzdndvphsindug.functions.supabase.co/purchase-webhook`, Authorization 헤더 값 = `REVENUECAT_WEBHOOK_SECRET` | 사용자 |
| App Store Connect / Google Play Console | 스토어 등록 · 인앱 상품 | `docs/LAUNCH.md` 절차 | 사용자 |

`.env.local` 형식(`.env.example` 참고):
```
EXPO_PUBLIC_SUPABASE_URL=https://ppyuaezzdndvphsindug.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_RC_IOS_KEY=
EXPO_PUBLIC_RC_ANDROID_KEY=
```
anon key 는 클라이언트 공개용 키라 앱에 들어가도 되지만, 이 저장소에는 넣지 않는다. service_role 은 어떤 파일에도 넣지 않는다.

## 3. Supabase 배포 — 한 번만
클로드 원격 세션은 `supabase.co` 로 나가는 네트워크가 막혀 있어 **여기서는 배포/검증이 불가능**하다. 사용자 PC(또는 supabase.co 가 열린 환경)에서:
```bash
npm i -g supabase && supabase login              # 브라우저 로그인 1회
npm run supabase:setup -- ppyuaezzdndvphsindug    # 스키마·RLS·트리거 push, Edge Functions 13개 배포, pg_cron 등록
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<임의의 긴 문자열>
```
그다음 대시보드에서 Auth → Providers 에 Google·Kakao 키 입력, Redirect URL 에 `wws://auth` 추가. 검증: `supabase/tests/rls.sql` 을 SQL 에디터에서 실행.
Claude 에게 서버 작업을 시키려면 `SUPABASE_ACCESS_TOKEN`(개인 액세스 토큰)과 DB 비밀번호를 세션 환경변수로 주고, supabase.co 네트워크를 허용해야 한다.

## 4. 개발 명령
```bash
npm install
npm run typecheck && npm run typecheck:functions     # 앱 · Edge Function 공통 코어
npx expo start                                       # Expo Go (.env.local 없으면 로컬 봇 시뮬)
npm run export:web && npx serve dist -l 8081 -s      # 웹 빌드 서빙 (터미널 1)
BASE=http://localhost:8081 CHROMIUM_PATH=/opt/pw-browsers/chromium npm run shots && npm run report   # 32단계 자동 검증 (터미널 2)
```
검증 스크립트는 사용자 관점 시나리오라서 화면 문구를 바꾸면 `scripts/screenshots.mjs` 도 같이 고친다. 결과는 `docs/VERIFICATION.md` 로 재생성.

## 5. 코드 지도
- `src/store/index.ts` 게임 규칙·로컬 봇 시뮬(정본). Supabase 모드에서는 같은 액션이 `RemoteBridge` 로 Edge Function 을 호출한다(`src/services/sync.ts`).
- `src/data/plans.ts` 코인·아이템·팩·플랜 상수. `src/data/vehicles.ts` 배달원 43종.
- `src/engine/sim.ts` 경로·진행률·통과 판정(클라이언트/서버 공통 알고리즘, 서버 사본은 `supabase/functions/_shared/sim.ts` — 둘을 같이 고친다).
- `src/services/analytics.ts` 트래킹(모든 버튼은 UI 키트의 `track` prop). 화면 진입은 `_layout.tsx`.
- `src/components/signup-sheet.tsx` 가입 게이트, `src/hooks/use-gate.ts`. `src/components/tour.tsx` 투어.
- `supabase/migrations/0001_schema.sql` 스키마·RLS. `supabase/functions/*` Edge Functions(Deno). 규칙 상수는 `_shared/core.ts` 의 `RULES` — 클라이언트 `plans.ts` 와 값이 같아야 한다.

## 6. 작업 습관
- 기능을 바꾸면: 타입체크 → 웹 export → 시나리오 주행(32/32) → `docs/VERIFICATION.md` 재생성 → 커밋(`Co-Authored-By` 줄 유지) → 푸시.
- 커밋 메시지·코드에 모델 이름을 쓰지 않는다. 키는 커밋하지 않는다.
- 사용자 보고는 한국어, 항목별로 짧게.
