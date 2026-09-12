# 검증 리포트 (사용자 관점 · 단계별)

- 실행: 2026-09-12T03:04:29.401Z · 웹 빌드를 390×844(iPhone 14) 뷰포트에서 Playwright 로 자동 주행 · 로컬 시뮬 모드(봇 60명)
- 결과: **38/38 통과** · 콘솔 오류 0건
- 재실행: `npm run export:web && npx serve dist -l 8081 -s` → `BASE=http://localhost:8081 CHROMIUM_PATH=... npm run shots && npm run report`

## 1. 첫 진입 · 온보딩

> 사용자 입장: 처음 연 사용자가 앱이 무엇인지 10초 안에 이해하고, 프로필과 위치를 2단계로 마친 뒤 살아있는 지구를 본다. 지구 위 배달원(커스텀 아이콘)이 실시간으로 움직이고, 경로는 보이지 않는다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 01 | 온보딩 · 첫 화면(워드마크·지구·기능 3줄) | ✅ | [01-onboarding-welcome](screenshots/01-onboarding-welcome.png) |
| 02 | 온보딩 · 프로필(아바타·닉네임·태그) | ✅ | [02-onboarding-profile](screenshots/02-onboarding-profile.png) |
| 03 | 온보딩 · 위치 선택(지구 탭/도시 칩/내 위치 버튼) | ✅ | [03-onboarding-location](screenshots/03-onboarding-location.png) · [03b-onboarding-location-picked](screenshots/03b-onboarding-location-picked.png) |
| 04 | 홈 · 국가 스토리 + 젠리 지구(경로 숨김·배달원 이동) + CTA | ✅ | [04-home](screenshots/04-home.png) · [04b-home-moving](screenshots/04b-home-moving.png) |

## 2. 둘러보기 · 5탭

> 사용자 입장: 편지·친구·커뮤니티·프로필·상점·설정이 인스타그램 문법으로 읽힌다. 커뮤니티는 국가 없이 km 거리만, 댓글이 붙고, 사람 탭에는 ⚡즉시 친구가 있다. 상점에는 엿보기/끌어오기/즉시 친구 한도가 플랜별로 적혀 있다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 05 | 편지 탭 · 빈 상태(걷는 배달원 안내) | ✅ | [05-letters-empty](screenshots/05-letters-empty.png) |
| 06 | 친구 탭 · 해금 진행 + 즉시 친구 안내 | ✅ | [06-friends-empty](screenshots/06-friends-empty.png) |
| 07 | 커뮤니티 · 엽서 피드(국가 없이 거리만 · 댓글) | ✅ | [07-community-feed](screenshots/07-community-feed.png) |
| 08 | 커뮤니티 · 사람(??? 카드·컨택%·⚡즉시 친구) | ✅ | [08-community-people](screenshots/08-community-people.png) |
| 09 | 커뮤니티 · 랭킹 | ✅ | [09-community-rank](screenshots/09-community-rank.png) |
| 10 | 프로필 · 인스타 레이아웃 + 배달원 격납고(43종·가족별) | ✅ | [10-profile](screenshots/10-profile.png) · [10b-profile-hangar](screenshots/10b-profile-hangar.png) |
| 11 | 상점 · 플랜 3종(엿보기/끌어오기/즉시 한도) + 아이템 8종 | ✅ | [11-store](screenshots/11-store.png) · [11b-store-items](screenshots/11b-store-items.png) |
| 12 | 설정 · 실제 권한 상태 + 테마(시스템/라이트/다크) + 백엔드 모드 | ✅ | [12-settings](screenshots/12-settings.png) |

## 3. 첫 편지 보내기

> 사용자 입장: 편지지에 쓰고(스토리 공유 옵션) → 목적지 → 배달원 가족(사람·새·동물·차·기차·배·비행·우주·전설) 중 해금된 것을 고른다. 보내면 내 편지만 경로가 보이고, 포커스를 풀면 다시 숨겨진다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 13 | 편지 쓰기 1 · 편지지 + 스토리 공유 옵션 | ✅ | [13-compose-text](screenshots/13-compose-text.png) |
| 14 | 편지 쓰기 2 · 목적지(랜덤/직접/경유지) | ✅ | [14-compose-dest-random](screenshots/14-compose-dest-random.png) · [14b-compose-dest-pick](screenshots/14b-compose-dest-pick.png) |
| 15 | 편지 쓰기 3 · 배달원 가족 칩 + 카드(커스텀 아이콘) · 방어권 · 조건 | ✅ | [15-compose-vehicle](screenshots/15-compose-vehicle.png) · [15b-compose-conditions](screenshots/15b-compose-conditions.png) |
| 16 | 발송 → 출발 → 홈 포커스(내 편지만 경로 표시) → 새로고침 시 경로 숨김 | ✅ | [16-launch](screenshots/16-launch.png) · [16b-home-focus-route](screenshots/16b-home-focus-route.png) · [16c-home-routes-hidden](screenshots/16c-home-routes-hidden.png) |

## 4. 머리 위 통과 → 엿보기 · 끌어오기 · 경로 · 잡기

> 사용자 입장: 배너를 탭하면 타이머와 7가지 행동. 무료는 엿보기 한도가 없어 상점으로 안내된다. 잡으면 봉투가 열리고 보낸 사람의 실제 프로필(소개·태그·엽서)과 공유 버튼이 보인다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 17 | 개발자 모드 · 편지 소환 → 홈 통과 배너 | ✅ | [17-settings-dev](screenshots/17-settings-dev.png) · [17b-home-passby](screenshots/17b-home-passby.png) |
| 18 | 잡기 화면 · 타이머 · 엿보기/끌어오기/경로/달팽이/되돌리기/바다/우주 | ✅ | [18-catch](screenshots/18-catch.png) · [18c-catch-pull-quota](screenshots/18c-catch-pull-quota.png) |
| 18b | 무료 · 첫 엿보기 렌즈 1개로 미리보기 → 끌어오기는 한도 없음 → 상점 안내 | ✅ | [18b-catch-peeked-free](screenshots/18b-catch-peeked-free.png) |
| 19 | 경로 바꾸기 · 경유지 1개 찍고 적용(무료 플랜 한도 1) | ✅ | [19-catch-reroute](screenshots/19-catch-reroute.png) · [19b-reroute-result](screenshots/19b-reroute-result.png) |
| 20 | 소환 → 잡기 → 편지 공개(봉투) + 보낸 사람 실제 프로필 + 공유 버튼 | ✅ | [20-catch-result](screenshots/20-catch-result.png) · [20b-letter-revealed](screenshots/20b-letter-revealed.png) · [20c-letter-sender-profile](screenshots/20c-letter-sender-profile.png) |
| 20d | 보낸 사람 프로필 열기(소개·태그·엽서) — ??? 아님 | ✅ | [20d-sender-profile](screenshots/20d-sender-profile.png) |
| 36 | 통과 알림 신뢰성 3회 (ok, ok, ok) | ✅ |  |

## 5. 왕복(답장 → 수락 편지 → 확정) → 실시간 채팅

> 사용자 입장: 답장을 보내면 "왕복 진행 중". 상대 답장이 오면 프로필을 보고 수락 → 수락 편지가 출발 → 상대가 확정하면 친구(왕복 A). 반대로 내 답장을 상대가 수락하면 수락 편지가 내게 오고 내가 확정한다(왕복 B). 그 뒤에만 지연 없는 채팅.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 21 | 답장 편지 쓰기(친구 요청 포함) | ✅ | [21-reply-compose](screenshots/21-reply-compose.png) · [21b-reply-confirm](screenshots/21b-reply-confirm.png) |
| 22 | 친구 탭 "왕복 진행 중" + 채팅 잠김(확정 전엔 편지로만) | ✅ | [22-friends-pending](screenshots/22-friends-pending.png) · [22b-chat-locked](screenshots/22b-chat-locked.png) |
| 23 | 봇 답장 소환 → 우편함 "답장" 도착 → 수락(수락 편지 출발) | ✅ | [23-letters-reply-inbox](screenshots/23-letters-reply-inbox.png) · [23b-home-accept-letter](screenshots/23b-home-accept-letter.png) |
| 24 | 빨리감기 → 수락 편지 도착 → 상대 확정 → 친구 1명 (왕복 A) | ✅ | [24-friends-first](screenshots/24-friends-first.png) |
| 25 | 내 답장이 도착 → 상대 수락 편지가 내게 옴 → "확정하고 채팅 시작" (왕복 B) | ✅ | [25-letters-accept-inbox](screenshots/25-letters-accept-inbox.png) · [25b-chat-open](screenshots/25b-chat-open.png) |
| 26 | 실시간 채팅 · 보내기 → 봇 응답 | ✅ | [26-chat-sent](screenshots/26-chat-sent.png) · [26b-chat-reply](screenshots/26b-chat-reply.png) |
| 27 | 친구 탭 · 친구 2명(닉네임 공개) + 홈 친구 버블 | ✅ | [27-friends-list](screenshots/27-friends-list.png) · [27b-home-with-friends](screenshots/27b-home-with-friends.png) |
| 28 | 활동(알림) 목록 | ✅ | [28-activity](screenshots/28-activity.png) |

## 6. 커뮤니티 · 국가 스토리 · 엽서 · 댓글 · ⚡즉시 친구

> 사용자 입장: 내 편지를 엽서로 공개하면 피드에는 거리만, 홈 상단 스토리에 국가 대표 사진으로 뜬다. 다른 나라 스토리를 탭해야 엽서 상세에서 국가가 공개된다. 왕복을 건너뛰는 ⚡즉시 친구는 결제(또는 코인)로 요청하고, 거절되면 환불된다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 29 | 내 편지를 엽서로 공개(+스토리) → 피드에 거리만 → 홈 스토리 "내 나라" | ✅ | [29-letter-published](screenshots/29-letter-published.png) · [29b-community-my-post](screenshots/29b-community-my-post.png) · [29c-home-story-mine](screenshots/29c-home-story-mine.png) |
| 30 | 홈 스토리 "어딘가" 탭 → 엽서 상세에서만 국가 공개 + 댓글 달기 | ✅ | [30-post-detail](screenshots/30-post-detail.png) · [30b-post-comment](screenshots/30b-post-comment.png) |
| 31 | ⚡ 즉시 친구(결제) · 코인으로 즉시 친구권 구매 → 요청 → 봇 응답(수락/거절 환불) | ✅ | [31-store-instant-bought](screenshots/31-store-instant-bought.png) · [31b-user-instant](screenshots/31b-user-instant.png) · [31c-user-instant-requested](screenshots/31c-user-instant-requested.png) · [31d-friends-after-instant](screenshots/31d-friends-after-instant.png) · [31e-instant-answered](screenshots/31e-instant-answered.png) |

## 7. 유료 플랜 · 엿보기/끌어오기 · 바다

> 사용자 입장: 플러스가 되면 경유지 2개, 엿보기 3회/일, 끌어오기 1회/일. 지나가는 편지를 엿보고 마음에 들면 내 위치로 끌어온다(편지당 1회, 방어권에 막힘). 바다에 빠뜨리면 몇 시간 멈추고 주인은 코인으로 건져낼 수 있다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 32 | 상점 · 테스트 결제(플러스) → 엿보기 3/일 · 끌어오기 1/일 · 경유지 2 | ✅ | [32-store-plus](screenshots/32-store-plus.png) · [32b-compose-plus-waypoints](screenshots/32b-compose-plus-waypoints.png) |
| 33 | 플러스 · 엿보기(내용 미리보기) → 마음에 들면 끌어오기(1회) → 내 위치로 방향 전환 | ✅ | [33-catch-peeked](screenshots/33-catch-peeked.png) · [33b-catch-pulled](screenshots/33b-catch-pulled.png) · [33c-home-pulled-incoming](screenshots/33c-home-pulled-incoming.png) |
| 34 | 바다에 빠뜨리기 → 몇 시간 정지(주인은 건져내기 가능) → 지구에 가라앉은 표시 | ✅ | [34-catch-gone-0](screenshots/34-catch-gone-0.png) · [34-catch-sunk](screenshots/34-catch-sunk.png) · [34b-home-sunk](screenshots/34b-home-sunk.png) |

## 8. 다크 모드

> 사용자 입장: 설정에서 시스템/라이트/다크를 고르면 인스타그램 다크 팔레트로 모든 화면과 지구(밤 바다)가 바뀐다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 35 | 다크 모드 · 설정에서 전환 → 홈/커뮤니티/편지/프로필/상점/잡기 | ✅ | [35-dark-settings](screenshots/35-dark-settings.png) · [35b-dark-home](screenshots/35b-dark-home.png) · [35c-dark-community](screenshots/35c-dark-community.png) · [35d-dark-letters](screenshots/35d-dark-letters.png) · [35e-dark-profile](screenshots/35e-dark-profile.png) · [35f-dark-store](screenshots/35f-dark-store.png) · [35g-dark-home-passby](screenshots/35g-dark-home-passby.png) · [35h-dark-catch](screenshots/35h-dark-catch.png) |

## 9. 실기기에서만 검증 가능한 항목 (체크리스트)

| 항목 | 구현 | 상태 |
|---|---|---|
| 위치 권한 요청 다이얼로그 · "내 위치" 버튼으로 실제 GPS 좌표 → 가장 가까운 도시명 | expo-location · 설정 화면에 실제 권한 상태 표시 | ⏳ 실기기 필요 |
| 알림 권한 요청 · 로컬 알림(머리 위 통과) 표시 · 알림 탭 시 잡기 화면으로 이동 | expo-notifications · subscribeNotificationTaps | ⏳ 실기기 필요 (Expo Go iOS 가능, Android 는 dev build) |
| 원격 푸시(서버 → Expo Push) 수신 | functions push() + EAS projectId 토큰 | ⏳ dev build + Firebase 배포 필요 |
| 백그라운드 위치 업데이트로 앱 닫힘 상태 통과 알림 | expo-task-manager + startBackgroundLocation | ⏳ dev build + 항상 허용 권한 필요 |
| 햅틱 (잡기·버튼) | expo-haptics | ⏳ 실기기 필요 |
| 사진 첨부 (사진 보관함 권한) | expo-image-picker | ⏳ 실기기 필요 (웹은 파일 선택) |
| 편지 이미지로 공유 (공유 시트) | react-native-view-shot captureRef + expo-sharing | ⏳ 실기기 필요 (웹은 미지원 안내) |
| 스토어 결제 · 구독 갱신 · 웹훅 지급 | react-native-purchases + revenuecatWebhook | ⏳ dev build + RevenueCat/스토어 샌드박스 |
| 지구 회전 성능 (저사양 Android) | Globe fps prop | ⏳ 실기기 필요 — 버벅이면 fps 24 → 16 |

## 10. 서버 모드 검증 (Firebase 배포 후)

| 항목 | 방법 |
|---|---|
| 두 기기 A/B 로 A 가 편지 발송 → B(경로 아래) 에 통과 푸시 | tickWorld 로그 · users/B/passbys 문서 생성 확인 |
| B 가 잡기 → A 에 "잡았어요" 푸시 | catchLetter 콜러블 |
| B 답장 → A 우편함(delivered) → A 수락 → 수락 편지 → B 확정 → chats/{A_B} 생성 → 양쪽 friendIds | approveReply (reply→accept 편지, accept→friends) |
| B 가 엿보기/끌어오기 → 한도 차감 · A 방어권 소모 · 편지 destination 변경 | redirectLetter(peek/pull) |
| 바다 추락 → sunkUntil 후 tickWorld 가 재부상 · rescueLetter 로 즉시 재개 | tickWorld / rescueLetter |
| ⚡즉시 친구 요청 → 상대 응답 → 친구 또는 환불 | requestInstantFriend / answerInstantFriend |
| B 가 경로 변경/달팽이 → A 방어권 소모 이벤트 | redirectLetter |
| RevenueCat 샌드박스 구독 → users/A.plan = plus | revenuecatWebhook |
| Firestore 규칙: 타인 users_private 읽기 거부 · letters 비참여자 읽기 거부 | 에뮬레이터 규칙 테스트 |
