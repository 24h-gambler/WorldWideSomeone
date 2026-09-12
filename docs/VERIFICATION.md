# 검증 리포트 (사용자 관점 · 단계별)

- 실행: 2026-09-12T16:12:29.574Z · 웹 빌드를 390×844(iPhone 14) 뷰포트에서 Playwright 로 자동 주행 · 로컬 시뮬 모드(봇 60명)
- 결과: **31/32 통과** · 콘솔 오류 0건
- 재실행: `npm run export:web && npx serve dist -l 8081 -s` → `BASE=http://localhost:8081 CHROMIUM_PATH=... npm run shots && npm run report`

## 1. 첫 진입 · 비회원 · 투어

> 사용자 입장: 가입 없이 환영 화면에서 바로 지구로 들어간다. 투어가 한 군데씩 짧은 CTA 로 안내하고 마지막에 편지 쓰기로 이어진다. 착륙한 편지는 남에게 보이지 않는다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 01 | 첫 진입 · 환영(가입 얘기 없음) → 둘러보기 | ✅ | [01-welcome](screenshots/01-welcome.png) |
| 02 | 위치 잡기(GPS 미허용 시 도시 선택) → 비회원으로 지구 입장 | ✅ | [02-location](screenshots/02-location.png) |
| 03 | 투어 · 한 군데씩 안내(짧은 CTA · 애니메이션) → 마지막 CTA "편지 쓰기" | ✅ | [03-tour-1](screenshots/03-tour-1.png) · [03b-tour-2](screenshots/03b-tour-2.png) · [03c-tour-3](screenshots/03c-tour-3.png) · [03d-tour-5](screenshots/03d-tour-5.png) · [03e-compose-from-tour](screenshots/03e-compose-from-tour.png) |
| 04 | 홈(비회원) · 국가 스토리 · 지구(경로 숨김 · 착륙 편지 비공개) · 배달원 이동 | ✅ | [04-home-guest](screenshots/04-home-guest.png) · [04b-home-moving](screenshots/04b-home-moving.png) |

## 2. 비회원 둘러보기 · 5탭

> 사용자 입장: 편지·친구·커뮤니티·프로필·상점·설정을 비회원으로 본다. 원화는 상점의 코인 팩에서만 보이고 나머지는 전부 SC. 커뮤니티는 받은 편지 수와 거리만.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 05 | 편지 탭 · 빈 상태 | ✅ | [05-letters-empty](screenshots/05-letters-empty.png) |
| 06 | 친구 탭 · 해금 진행(대여 안내) | ✅ | [06-friends-empty](screenshots/06-friends-empty.png) |
| 07 | 커뮤니티 · 피드(거리만 · 댓글) · 원화 표기 없음 | ✅ | [07-community-feed](screenshots/07-community-feed.png) |
| 08 | 커뮤니티 · 사람(받은 편지 수 · ⚡직행) | ✅ | [08-community-people](screenshots/08-community-people.png) |
| 09 | 프로필(비회원) · "가입하고 편지 보내기" | ✅ | [09-profile-guest](screenshots/09-profile-guest.png) |
| 10 | 상점 · 코인 팩(원화는 여기만) · 아이템은 SC · 플랜 | ✅ | [10-store](screenshots/10-store.png) · [10b-store-items](screenshots/10b-store-items.png) |
| 11 | 설정 · 권한 · 테마 · 백엔드(Supabase 미설정 → 로컬) | ✅ | [11-settings](screenshots/11-settings.png) |

## 3. 가입 게이트 → 첫 편지

> 사용자 입장: 편지를 다 쓰고 보내기를 누르는 순간에만 SNS 가입 시트가 뜬다(나중에 가능). 가입하면 바로 발송되고 홈에는 속도·거리만(도착 시간 없음).

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 12 | 편지 쓰기 3단계(비회원 가능) · 배달원 카드에 대여 SC · 원화 없음 | ✅ | [12-compose-text](screenshots/12-compose-text.png) · [12b-compose-vehicle](screenshots/12b-compose-vehicle.png) |
| 13 | 보내기 → 가입 게이트(SNS) → "나중에" → 다시 보내기 → Google → 프로필 → 발송 | ✅ | [13-gate](screenshots/13-gate.png) · [13b-launch](screenshots/13b-launch.png) · [13c-home-after-send](screenshots/13c-home-after-send.png) |

## 4. 머리 위 통과 → 엿보기 · 끌어오기 · 경로 · 침수 · 잡기

> 사용자 입장: 되돌리기는 없다. 침수·우주·달팽이·경로·엿보기·끌어오기. 잡으면 보낸 사람의 실제 프로필과 공유 버튼.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 14 | 소환 → 통과 배너 → 잡기 화면: 되돌리기 없음 · 침수 · SC 표기 | ✅ | [14-home-passby](screenshots/14-home-passby.png) · [14b-catch](screenshots/14b-catch.png) |
| 15 | 첫 엿보기 렌즈로 미리보기 → 끌어오기 한도 → 상점 | ✅ | [15-catch-peeked](screenshots/15-catch-peeked.png) |
| 16 | 경로 바꾸기(경유지 1) | ✅ | [16-reroute](screenshots/16-reroute.png) |
| 17 | 잡기 → 봉투 → 보낸 사람 실제 프로필 · 공유 | ✅ | [17-letter-revealed](screenshots/17-letter-revealed.png) |
| 18 | 답장 편지 쓰기(직행 · 친구 요청) → 발송 → "왕복 진행 중" | ✅ | [18-reply-confirm](screenshots/18-reply-confirm.png) · [18b-friends-roundtrip](screenshots/18b-friends-roundtrip.png) |
| 32 | 통과 알림 신뢰성 3회 (miss, ok, miss) | ❌  |  |

## 5. 왕복(내 편지 → 상대 답장) · 코인 가속 → 수락 → 채팅

> 사용자 입장: 오는 답장은 속도와 나와의 거리만 보인다. 느리면 SC 로 4배/1분 가속. 도착하면 수락 → 친구 + 실시간 채팅. 친구는 홈 지구에 50km 원으로.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 19 | 답장 소환 → 우편함 "오는 중": 속도·거리만(도착 시간 없음) + 가속 버튼 | ✅ | [19-inbox-incoming](screenshots/19-inbox-incoming.png) |
| 20 | 코인 부족 → 상점 안내 · +코인 → "1분 안에" 가속 → 도착 → 수락하고 채팅 시작 | ✅ | [20-boosted](screenshots/20-boosted.png) · [20b-inbox-arrived](screenshots/20b-inbox-arrived.png) · [20c-chat-open](screenshots/20c-chat-open.png) |
| 21 | 실시간 채팅 · 보내기 → 봇 응답 | ✅ | [21-chat-reply](screenshots/21-chat-reply.png) |
| 22 | 내 답장 도착 → 상대 수락(봇) → 친구 2명 · 홈 친구 50km 원 | ✅ | [22-friends](screenshots/22-friends.png) · [22b-home-friend-disc](screenshots/22b-home-friend-disc.png) |

## 6. 커뮤니티 · 국가 스토리 · 댓글 · ⚡ 직행 편지

> 사용자 입장: 엽서 공개 → 홈 스토리(국가는 탭해야) → 댓글. 직행 편지는 300 SC 로 그 사람에게 무조건 도착, 환불 없음.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 23 | 내 편지 엽서 공개 → 피드 거리만 → 홈 스토리 "내 나라" → 스토리 순서(최신순) | ✅ | [23-community-my-post](screenshots/23-community-my-post.png) · [23b-home-story-mine](screenshots/23b-home-story-mine.png) |
| 24 | 스토리 탭 → 엽서 상세에서 국가 공개 · 댓글 | ✅ | [24-post-comment](screenshots/24-post-comment.png) |
| 25 | ⚡ 직행 편지(300 SC · 환불 없음) → 작성 → "직행 보내기" → 친구 탭 진행 중 | ✅ | [25-user-direct](screenshots/25-user-direct.png) · [25b-compose-direct](screenshots/25b-compose-direct.png) · [25c-friends-direct](screenshots/25c-friends-direct.png) |

## 7. 플랜 · 대여 · 플러스 엿보기/끌어오기 · 침수

> 사용자 입장: 플랜은 매월 SC 와 한도·할인. 잠긴 배달원은 SC 로 1회 대여. 침수는 몇 시간 정지, 주인은 SC 로 구조.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 26 | 플랜(플러스) 테스트 결제 → 매월 SC 지급 · 한도 표시 | ✅ | [26-store-plus](screenshots/26-store-plus.png) |
| 27 | 배달원 대여(SC)로 잠긴 여객기 1회 사용 | ✅ | [27-compose-rental](screenshots/27-compose-rental.png) |
| 28 | 플러스 · 엿보기 → 끌어오기(내 위치로) | ✅ | [28-catch-peeked-plus](screenshots/28-catch-peeked-plus.png) · [28-home-pulled](screenshots/28-home-pulled.png) |
| 29 | 침수 → 몇 시간 정지 → 지구 표시 | ✅ | [29-catch-gone-0](screenshots/29-catch-gone-0.png) · [29-catch-sunk](screenshots/29-catch-sunk.png) · [29b-home-sunk](screenshots/29b-home-sunk.png) |

## 8. 다크 모드 · 트래킹

> 사용자 입장: 인스타 다크 팔레트. 비회원 시점부터 화면·버튼·스크롤·게이트·가입 이벤트가 전부 기록된다.

| # | 검증 항목 | 결과 | 증거 |
|---|---|---|---|
| 30 | 다크 모드 · 홈/커뮤니티/편지/상점/잡기 | ✅ | [30-dark-home](screenshots/30-dark-home.png) · [30b-dark-community](screenshots/30b-dark-community.png) · [30c-dark-letters](screenshots/30c-dark-letters.png) · [30d-dark-store](screenshots/30d-dark-store.png) · [30e-dark-catch](screenshots/30e-dark-catch.png) |
| 31 | 트래킹 · 화면/버튼/스크롤/게이트/가입 이벤트가 비회원 시점부터 기록됨 | ✅ |  |

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

## 10. 서버 모드 검증 (Supabase 배포 후)

| 항목 | 방법 |
|---|---|
| 두 기기 A/B 로 A 가 편지 발송 → B(경로 아래) 에 통과 푸시 | tickWorld 로그 · users/B/passbys 문서 생성 확인 |
| B 가 잡기 → A 에 "잡았어요" 푸시 | catchLetter 콜러블 |
| B 답장 → A 우편함(delivered) → A 수락 → chats 생성 → 양쪽 friend_ids | approve-reply |
| A 가 오는 답장을 SC 로 가속 → arrives_at 단축 · coin_ledger 기록 | boost-reply |
| B 가 엿보기/끌어오기 → 한도 차감 · A 방어권 소모 · 편지 destination 변경 | redirectLetter(peek/pull) |
| 바다 추락 → sunkUntil 후 tickWorld 가 재부상 · rescueLetter 로 즉시 재개 | tickWorld / rescueLetter |
| ⚡즉시 친구 요청 → 상대 응답 → 친구 또는 환불 | requestInstantFriend / answerInstantFriend |
| B 가 경로 변경/달팽이 → A 방어권 소모 이벤트 | redirectLetter |
| RevenueCat 샌드박스 코인 팩/플랜 → purchases(중복 방지) · users.coins/plan | purchase-webhook |
| 통과 판정 셀 조인 · 핫셀 샘플 · 편지당 상한 · 푸시 하루 12건/조용한 시간 | tick-world · push-dispatch (docs/SCALE.md) |
| 트래킹 배치 → events (비회원 포함) | track-events |
| RLS: users_private 아무도 못 읽음 · letters 비참여자 거부 · 게임 필드 클라이언트 수정 차단(트리거) | supabase/tests/rls.sql |
