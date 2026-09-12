# 검증 리포트 (사용자 관점 · 단계별)

- 실행: 2026-09-12T01:44:31.818Z · 웹 빌드를 390×844(iPhone 14) 뷰포트에서 Playwright 로 자동 주행 · 로컬 시뮬 모드(봇 60명)
- 결과: **28/28 통과** · 콘솔 오류 0건
- 재실행: `npm run export:web && npx serve dist -l 8081 -s` → `BASE=http://localhost:8081 CHROMIUM_PATH=... npm run shots && npm run report`

## 1. 첫 진입 · 온보딩

> 사용자 입장: 처음 연 사용자가 앱이 무엇인지 10초 안에 이해하고, 프로필과 위치를 2단계로 마친 뒤 살아있는 지구를 본다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 01 | 온보딩 · 첫 화면(워드마크·지구·기능 3줄) | ✅ | [01-onboarding-welcome](screenshots/01-onboarding-welcome.png) |
| 02 | 온보딩 · 프로필(아바타·닉네임·태그) | ✅ | [02-onboarding-profile](screenshots/02-onboarding-profile.png) |
| 03 | 온보딩 · 위치 선택(지구 탭/도시 칩/내 위치 버튼) | ✅ | [03-onboarding-location](screenshots/03-onboarding-location.png) · [03b-onboarding-location-picked](screenshots/03b-onboarding-location-picked.png) |
| 04 | 홈 · 스토리 행 + 젠리 지구 + 편지 쓰기 CTA | ✅ | [04-home](screenshots/04-home.png) |

## 2. 둘러보기 · 5탭

> 사용자 입장: 편지·친구·커뮤니티·프로필·상점·설정이 인스타그램 문법으로 익숙하게 읽힌다. 커뮤니티는 ???만 보이고 컨택 가능성이 표시된다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 05 | 편지 탭 · 빈 상태(걷는 배달원 안내) | ✅ | [05-letters-empty](screenshots/05-letters-empty.png) |
| 06 | 친구 탭 · 해금 진행 + 빈 상태 | ✅ | [06-friends-empty](screenshots/06-friends-empty.png) |
| 07 | 커뮤니티 · 엽서 피드(인스타 포스트) | ✅ | [07-community-feed](screenshots/07-community-feed.png) |
| 08 | 커뮤니티 · 사람(??? 카드·컨택%) | ✅ | [08-community-people](screenshots/08-community-people.png) |
| 09 | 커뮤니티 · 랭킹 | ✅ | [09-community-rank](screenshots/09-community-rank.png) |
| 10 | 프로필 · 인스타 레이아웃(링·통계·배달원 격납고) | ✅ | [10-profile](screenshots/10-profile.png) |
| 11 | 상점 · 플랜 3종 + 아이템 + 성장 두 갈래 | ✅ | [11-store](screenshots/11-store.png) |
| 12 | 설정 · 실제 권한 상태(위치/알림) + 백엔드 모드 | ✅ | [12-settings](screenshots/12-settings.png) |

## 3. 첫 편지 보내기

> 사용자 입장: 편지지에 쓰고 → 목적지를 고르고(랜덤/직접/경유지) → 걷는 배달원(친구 0명)으로 보낸다. 방어권·엽서 공개·받는 사람 조건·컨택%를 확인한다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 13 | 편지 쓰기 1 · 편지지 | ✅ | [13-compose-text](screenshots/13-compose-text.png) |
| 14 | 편지 쓰기 2 · 목적지(랜덤/직접/경유지) | ✅ | [14-compose-dest-random](screenshots/14-compose-dest-random.png) · [14b-compose-dest-pick](screenshots/14b-compose-dest-pick.png) |
| 15 | 편지 쓰기 3 · 배달원(걷기만 해금) · 방어권 · 조건 · 컨택% | ✅ | [15-compose-vehicle](screenshots/15-compose-vehicle.png) · [15b-compose-conditions](screenshots/15b-compose-conditions.png) |
| 16 | 편지 발송 → 출발 애니메이션 → 홈 포커스 카드 | ✅ | [16-launch](screenshots/16-launch.png) · [16b-home-after-send](screenshots/16b-home-after-send.png) |

## 4. 머리 위 통과 → 잡기 / 장난

> 사용자 입장: 알림(배너)을 탭하면 타이머와 함께 잡기 또는 경로 바꾸기(경유지 1개, 결제 시 2·3개)·달팽이·되돌리기·바다·우주를 고른다. 방어권이 있으면 튕겨나간다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 17 | 개발자 모드 · 편지 소환 → 홈 통과 배너 | ✅ | [17-settings-dev](screenshots/17-settings-dev.png) · [17b-home-passby](screenshots/17b-home-passby.png) |
| 18 | 잡기 화면 · 타이머 · 잡기/경로 바꾸기/달팽이/되돌리기/바다/우주 | ✅ | [18-catch](screenshots/18-catch.png) |
| 19 | 경로 바꾸기 · 경유지 1개 찍고 적용(무료 플랜 한도 1) | ✅ | [19-catch-reroute](screenshots/19-catch-reroute.png) · [19b-reroute-result](screenshots/19b-reroute-result.png) |
| 20 | 두 번째 소환 → 잡기 → 편지 공개(봉투 애니메이션) | ✅ | [20-catch-result](screenshots/20-catch-result.png) · [20b-letter-revealed](screenshots/20b-letter-revealed.png) |
| 28 | 통과 알림 신뢰성 3회 (ok, ok, ok) | ✅ |  |

## 5. 답장 → 승인 → 실시간 채팅

> 사용자 입장: 잡은 편지에 답장(직행·친구 요청 포함)을 보낸다. 승인 전 채팅은 잠겨 있다. 내 편지에 온 답장을 승인하면 친구가 되고 지연 없는 채팅이 열린다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 21 | 답장 편지 쓰기(직행 · 친구 요청 포함) | ✅ | [21-reply-compose](screenshots/21-reply-compose.png) · [21b-reply-confirm](screenshots/21b-reply-confirm.png) |
| 22 | 채팅 잠김 상태(승인 전에는 편지로만) | ✅ | [22-friends-pending](screenshots/22-friends-pending.png) · [22b-chat-locked](screenshots/22b-chat-locked.png) |
| 23 | 봇 답장 소환 → 편지 탭 "답장" 도착 → 승인 | ✅ | [23-letters-reply-inbox](screenshots/23-letters-reply-inbox.png) · [23b-chat-open](screenshots/23b-chat-open.png) |
| 24 | 실시간 채팅 · 보내기 → 봇 응답 | ✅ | [24-chat-sent](screenshots/24-chat-sent.png) · [24b-chat-reply](screenshots/24b-chat-reply.png) |
| 25 | 친구 탭 · 친구 1명(닉네임 공개) + 홈 스토리 링 | ✅ | [25-friends-list](screenshots/25-friends-list.png) · [25b-home-with-friend](screenshots/25b-home-with-friend.png) |
| 26 | 활동(알림) 목록 | ✅ | [26-activity](screenshots/26-activity.png) |

## 6. 요금제 · 결제

> 사용자 입장: 상점에서 플랜을 비교하고(테스트 결제) 플러스가 되면 경유지가 2개로 늘어난다. 방어권은 친구 5명마다 또는 결제로 얻는다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 27 | 상점 · 테스트 결제(플러스) → 경유지 2개 반영 | ✅ | [27-store-plus](screenshots/27-store-plus.png) · [27b-compose-plus-waypoints](screenshots/27b-compose-plus-waypoints.png) |

## 7. 실기기에서만 검증 가능한 항목 (체크리스트)

| 항목 | 구현 | 상태 |
|---|---|---|
| 위치 권한 요청 다이얼로그 · "내 위치" 버튼으로 실제 GPS 좌표 → 가장 가까운 도시명 | expo-location · 설정 화면에 실제 권한 상태 표시 | ⏳ 실기기 필요 |
| 알림 권한 요청 · 로컬 알림(머리 위 통과) 표시 · 알림 탭 시 잡기 화면으로 이동 | expo-notifications · subscribeNotificationTaps | ⏳ 실기기 필요 (Expo Go iOS 가능, Android 는 dev build) |
| 원격 푸시(서버 → Expo Push) 수신 | functions push() + EAS projectId 토큰 | ⏳ dev build + Firebase 배포 필요 |
| 백그라운드 위치 업데이트로 앱 닫힘 상태 통과 알림 | expo-task-manager + startBackgroundLocation | ⏳ dev build + 항상 허용 권한 필요 |
| 햅틱 (잡기·버튼) | expo-haptics | ⏳ 실기기 필요 |
| 사진 첨부 (사진 보관함 권한) | expo-image-picker | ⏳ 실기기 필요 (웹은 파일 선택) |
| 스토어 결제 · 구독 갱신 · 웹훅 지급 | react-native-purchases + revenuecatWebhook | ⏳ dev build + RevenueCat/스토어 샌드박스 |
| 지구 회전 성능 (저사양 Android) | Globe fps prop | ⏳ 실기기 필요 — 버벅이면 fps 24 → 16 |

## 8. 서버 모드 검증 (Firebase 배포 후)

| 항목 | 방법 |
|---|---|
| 두 기기 A/B 로 A 가 편지 발송 → B(경로 아래) 에 통과 푸시 | tickWorld 로그 · users/B/passbys 문서 생성 확인 |
| B 가 잡기 → A 에 "잡았어요" 푸시 | catchLetter 콜러블 |
| B 답장 → A 우편함(delivered) → A 승인 → chats/{A_B} 생성 → 양쪽 friendIds | approveReply |
| B 가 경로 변경/달팽이 → A 방어권 소모 이벤트 | redirectLetter |
| RevenueCat 샌드박스 구독 → users/A.plan = plus | revenuecatWebhook |
| Firestore 규칙: 타인 users_private 읽기 거부 · letters 비참여자 읽기 거부 | 에뮬레이터 규칙 테스트 |
