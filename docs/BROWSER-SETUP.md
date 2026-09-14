# 브라우저에서 직접 해야 할 일 (순서대로)

이 문서는 **사람이 크롬에서 해야 하는 콘솔 작업만** 순서대로 적은 것이다. 각 절 맨 앞의 `▶ 크롬에게` 블록은 브라우저를 조작하는 에이전트(예: Claude for Chrome)에게 그대로 붙여넣을 수 있게 쓴 지시문이다.
터미널에서 하는 일(스키마 배포·시크릿 생성·EAS)은 `⌘ 터미널` 로 표시했다. 순서를 지켜야 한다 — 뒤 단계는 앞 단계에서 받은 값을 쓴다.

프로젝트 고정값
| 이름 | 값 |
|---|---|
| Supabase 프로젝트 ref | `ppyuaezzdndvphsindug` |
| Supabase 콜백 URL(모든 콘솔에 넣는 값) | `https://ppyuaezzdndvphsindug.supabase.co/auth/v1/callback` |
| 앱 딥링크 | `wws://auth` |
| iOS 번들 ID / Android 패키지 | `com.worldwidesomeone.app` |
| Apple Services ID(웹용) | `com.worldwidesomeone.web` |

## 0. 시작 전에

1. 크롬에서 다음 계정에 **미리 로그인**해 둔다(2단계 인증은 사람이 직접 해야 한다): Apple Developer, Google(2id.kimdan), 카카오, Supabase, Firebase, RevenueCat.
2. Apple Developer Program 유료 가입(연 ₩129,000)이 안 돼 있으면 1절을 진행할 수 없다. 먼저 가입한다.
3. 아래 표를 메모장이나 비밀번호 관리자에 만들어 두고, 각 단계에서 받은 값을 채운다.

| # | 값 | 어디서 받나 | 어디에 넣나 |
|---|---|---|---|
| 1 | Apple Team ID | 1-1 | 애플 시크릿 생성 |
| 2 | Apple Key ID + `.p8` 파일 | 1-4 | 애플 시크릿 생성 |
| 3 | Apple client secret(JWT) | 1-5 | Supabase Apple 공급자 |
| 4 | Google Client ID / Secret | 2-5 | Supabase Google 공급자 |
| 5 | Kakao REST API 키 / Client Secret | 3-2, 3-4 | Supabase Kakao 공급자 |
| 6 | Supabase service_role 키 | 4-3 | 터미널(배포)에서만 |
| 7 | FCM 서비스 계정 JSON | 5 | `eas credentials` 업로드 |
| 8 | RevenueCat iOS/Android 공개 키 | 6-4 | `.env.local` |

**보안**: `.p8` 파일, service_role 키, 카카오 Client Secret, 애플 JWT 는 채팅창·이슈·커밋에 절대 남기지 않는다. 복사 → 해당 콘솔에 붙여넣기까지만 한다. `.p8` 는 재다운로드가 불가능하니 안전한 곳에 보관한다.

## 1. Apple Developer — 애플 로그인 (가장 오래 걸림, 먼저 한다)

> ▶ 크롬에게: developer.apple.com/account 를 열어. ① Membership details 에서 Team ID 를 알려줘. ② Certificates, Identifiers & Profiles → Identifiers 에서 `com.worldwidesomeone.app` 라는 App ID 가 있는지 보고, 없으면 App IDs → App 타입으로 만들고 Description 은 WorldWideSomeone, Bundle ID 는 explicit `com.worldwidesomeone.app` 로 등록해. 있든 없든 Capabilities 목록에서 **Sign In with Apple** 을 체크하고 저장해. ③ 그다음 Identifiers → Services IDs 로 `com.worldwidesomeone.web` 을 만들고, 그 항목을 열어 Sign In with Apple 을 체크한 뒤 Configure 에서 Primary App ID 를 `com.worldwidesomeone.app`, Domains 에 `ppyuaezzdndvphsindug.supabase.co`, Return URLs 에 `https://ppyuaezzdndvphsindug.supabase.co/auth/v1/callback` 를 넣고 저장해. ④ Keys 에서 새 키를 만들고 이름은 `WWS Sign in with Apple`, Sign in with Apple 을 체크한 뒤 Primary App ID 를 위와 동일하게 지정하고 등록해. 다운로드 버튼이 나오면 알려줘 — 내가 직접 받을게. 마지막으로 Key ID 를 알려줘.

1-1. **Team ID** 기록 (Membership details).
1-2. App ID `com.worldwidesomeone.app` 에 **Sign In with Apple** 체크.
1-3. **Services ID** `com.worldwidesomeone.web` 생성 + Sign In with Apple 설정(Domain·Return URL 은 위 표의 콜백 URL).
1-4. **Key** 생성 → `.p8` 다운로드(딱 한 번) + **Key ID** 기록.
1-5. ⌘ 터미널 — 애플이 요구하는 client secret(JWT)을 만든다. 6개월마다 다시 만들어 Supabase 에 교체해야 한다.
```bash
node scripts/apple-client-secret.mjs \
  --team-id <Team ID> --key-id <Key ID> \
  --services-id com.worldwidesomeone.web --p8 ~/Downloads/AuthKey_<Key ID>.p8
```

## 2. Google Cloud — 구글 로그인

> ▶ 크롬에게: console.cloud.google.com 을 열어 프로젝트 `WorldWideSomeone` 을 새로 만들어(있으면 선택). 그다음 APIs & Services → OAuth consent screen 에서 User type 은 External, 앱 이름 `WorldWideSomeone`, 지원 이메일과 개발자 연락처는 내 계정 이메일로 설정하고 저장해. 스코프는 `openid`, `email`, `profile` 만 추가해. 마지막으로 Credentials → Create credentials → OAuth client ID → Application type 은 Web application, 이름은 `Supabase`, Authorized redirect URIs 에 `https://ppyuaezzdndvphsindug.supabase.co/auth/v1/callback` 를 넣고 만들어. 생성된 Client ID 와 Client secret 을 알려줘.

2-1 ~ 2-4. 프로젝트 생성 → OAuth 동의 화면(External, 앱 이름·이메일·개인정보처리방침 URL) → 스코프 `openid/email/profile` → 테스트 사용자 등록(출시 전에는 테스트 모드라도 된다).
2-5. **Web application** OAuth 클라이언트 생성 → **Client ID / Client secret** 기록.
iOS·Android 용 클라이언트는 따로 만들 필요가 없다. 앱은 Supabase 콜백을 거치는 웹 플로우를 쓴다.

## 3. Kakao Developers — 카카오 로그인

> ▶ 크롬에게: developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가하기로 앱 이름 `WorldWideSomeone`, 회사명도 같게 해서 만들어. 만든 앱에서 ① 앱 키의 **REST API 키** 를 알려주고, ② 카카오 로그인 메뉴에서 활성화를 ON 으로 바꾼 뒤 Redirect URI 에 `https://ppyuaezzdndvphsindug.supabase.co/auth/v1/callback` 를 등록하고, ③ 카카오 로그인 → 보안에서 Client Secret 을 생성하고 상태를 사용함으로 바꾼 다음 값을 알려줘. ④ 동의항목에서 닉네임은 필수 동의, 프로필 사진과 카카오계정(이메일)은 선택 동의로 설정해. ⑤ 플랫폼 메뉴에서 iOS 번들 ID `com.worldwidesomeone.app` 와 Android 패키지명 `com.worldwidesomeone.app` 을 등록해(키 해시는 비워둬, 내가 나중에 넣을게).

3-1 ~ 3-5. 앱 생성 → **REST API 키** → 카카오 로그인 ON + Redirect URI → **Client Secret** → 동의항목 → 플랫폼 등록.
3-6. ⌘ 터미널 — 안드로이드 키 해시는 EAS 빌드 이후에 넣는다: `eas credentials` → Android → keystore 의 SHA-1 을 base64 로 바꿔 카카오 플랫폼 설정에 추가.
이메일 동의항목은 심사(비즈니스 앱 전환)가 필요할 수 있다. 없으면 닉네임만으로도 로그인은 동작한다.

## 4. Supabase 대시보드 — 받은 키 꽂기

> ▶ 크롬에게: supabase.com/dashboard 에서 프로젝트 `ppyuaezzdndvphsindug` 를 열어. Authentication → Sign In / Providers 에서 ① Apple 을 켜고 Client IDs 칸에 `com.worldwidesomeone.web,com.worldwidesomeone.app` 를 넣고 Secret Key 칸에는 내가 주는 JWT 를 붙여넣어, ② Google 을 켜고 내가 주는 Client ID 와 Secret 을 넣어, ③ Kakao 를 켜고 REST API 키와 Client Secret 을 넣어. 각각 저장해. 그다음 Authentication → URL Configuration 에서 Site URL 을 `wws://auth` 로 하고 Redirect URLs 에 `wws://auth` 와 `http://localhost:8081` 을 추가해.

4-1. Providers 세 개(Apple·Google·Kakao) 활성화 + 키 입력.
4-2. URL Configuration: Site URL `wws://auth`, Redirect URLs `wws://auth`, `http://localhost:8081`.
4-3. Settings → API 에서 `Project URL`·`anon key` 확인(이미 `.env.local` 에 있음). **service_role** 키는 5절 배포 때만 쓰고 파일에 남기지 않는다.
4-4. ⌘ 터미널 — 스키마·함수 배포(아직 안 했다면). `CLAUDE.md` 3절과 동일:
```bash
npm i -g supabase && supabase login
npm run supabase:setup -- ppyuaezzdndvphsindug
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<임의의 긴 문자열>
```
4-5. 배포 후 SQL Editor 에서 `supabase/tests/rls.sql` 을 실행해 권한이 의도대로인지 확인한다.

## 5. Firebase — 안드로이드 푸시(FCM)만

> ▶ 크롬에게: console.firebase.google.com 에서 2id.kimdan 계정으로 프로젝트 `WorldWideSomeone` 을 만들어(애널리틱스는 꺼도 돼). 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성을 눌러 JSON 을 받을 수 있는 화면까지 가줘 — 다운로드는 내가 할게.

받은 JSON 은 ⌘ 터미널에서 `eas credentials` → Android → Push Notifications (FCM V1) 에 업로드한다. Firestore·Functions 는 쓰지 않는다. iOS 는 APNs 키를 EAS 가 만들어 준다.

## 6. RevenueCat — 결제

> ▶ 크롬에게: app.revenuecat.com 에서 프로젝트 `WorldWideSomeone` 을 만들고 App Store 앱과 Play Store 앱을 각각 추가해. Products 에 `wws_sc_300`, `wws_sc_800`, `wws_sc_2000`, `wws_sc_5500`, `wws_sc_12000`, `wws_plus_monthly`, `wws_pro_monthly` 를 등록하고, 구독 두 개는 Entitlement `plus`·`pro` 에 연결해. API keys 화면의 iOS·Android **public** 키를 알려줘. 마지막으로 Integrations → Webhooks 에서 URL 은 `https://ppyuaezzdndvphsindug.functions.supabase.co/purchase-webhook`, Authorization 헤더에는 내가 주는 값을 넣어 저장해.

6-4. 받은 공개 키는 `.env.local` 의 `EXPO_PUBLIC_RC_IOS_KEY`·`EXPO_PUBLIC_RC_ANDROID_KEY` 에 넣는다(저장소에는 커밋하지 않는다). 웹훅 Authorization 값은 4-4 에서 넣은 `REVENUECAT_WEBHOOK_SECRET` 과 같아야 한다.

## 7. App Store Connect — iOS 앱 · 인앱 상품

> ▶ 크롬에게: appstoreconnect.apple.com → 앱 → 새로운 앱으로 이름 `WorldWideSomeone`, 기본 언어 한국어, 번들 ID `com.worldwidesomeone.app`, SKU `wws` 로 등록해. 그다음 수익화 → 앱 내 구입에서 소모품으로 `wws_sc_300`, `wws_sc_800`, `wws_sc_2000`, `wws_sc_5500`, `wws_sc_12000` 을, 자동 갱신 구독으로 `wws_plus_monthly`, `wws_pro_monthly` 를 만들어(가격은 내가 정할게). 각 상품의 표시 이름과 설명은 한국어로 채워줘.

앱 정보에서 개인정보 처리방침 URL, 앱 개인정보 보호(수집 항목: 위치·연락처 아님·사용 데이터) 설문을 채워야 심사에 올라간다. 애플 로그인은 1절에서 이미 켰다.

## 8. Google Play Console — 안드로이드 앱 · 인앱 상품

> ▶ 크롬에게: play.google.com/console 에서 앱 `WorldWideSomeone` 을 만들고(무료, 앱 유형: 앱), 수익 창출 → 인앱 상품에 App Store 와 같은 ID 7개를 만들어. 그리고 테스트 → 내부 테스트 트랙을 만들어 내 계정을 테스터로 넣어줘.

데이터 보안 설문(위치 수집·전송 여부)과 개인정보 처리방침 URL 이 필수다.

## 9. 끝난 뒤 확인

1. `.env.local` 에 Supabase URL·anon key·RevenueCat 키가 들어 있다(커밋되지 않는다).
2. Supabase → Authentication → Providers 에 Apple·Google·Kakao 가 모두 켜져 있다.
3. ⌘ 터미널 `npx expo start` → 편지 보내기를 누르면 가입 시트에서 세 버튼이 뜨고, 실제 로그인 창이 열린다.
4. 애플 client secret 만료일(생성일 +180일)을 캘린더에 적어 둔다. 만료되면 애플 로그인만 조용히 실패한다.
