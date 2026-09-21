# REFS-ASTREAM — 스푼 → Astream (사용자 지정)

전수조사: 2026-09-21. App Store "스푼 : 라이브 & 팟노블"(Spoonlabs, ★3.4, 8.4천 리뷰) 실확인.
AStream repo README가 직접 "스푼처럼 목소리만으로 방송"이라 명시 — 방향 일치.
AStream 스택: Next.js 16 + Capacitor + Supabase (브랜치 `claude/voice-streaming-platform-vtg7kl`, CI 없음).

## 스푼 → Astream 매핑 (AStream README 구조에 대입)

- **S1 룸 카드 규격**: 스푼=썸네일+LIVE+청취자수. AStream은 썸네일 없음이 원칙 → **컨셉 한 줄·목소리 태그·장르색** 3요소로 대체 (repo가 이미 이렇게 설계 — 감사 포인트: 3요소가 카드에서 2초 안에 읽히는지).
- **S2 라이브 룸**: 스푼=채팅+리액션+기프트. AStream 룸(스테이지 60%+채팅 40%, 공지 고정, 3단 반응: 무료 리액션 > 유료 기프트) — 감사 포인트: 채팅 40% 점유 유지, 입력 바 엄지 도달거리, 후원 2탭 확인.
- **S3 미니 플레이어**: 방을 나가도 계속 듣기 (스푼 핵심) — AStream 원칙에 있음. 감사 포인트: 전환 시 오디오 끊김·상태 동기화.
- **S4 카테고리·랭킹**: 스푼 DJ 카테고리 → AStream 장르 12종+정렬(인기/방금시작/소규모) + DJ 랭킹(받은 AS)·팬 랭킹. 감사 포인트: 소규모 방 발견 가능성(롱테일).
- **S5 크리에이터 진입**: 스푼 방송 켜기 1탭 → AStream /cast (마이크 체크→컨셉→송출 콘솔). 감사 포인트: 첫 방송까지 3단계 이탈률.
- **S6 과금 경계**: 스푼 저평점(3.4) 요인 — 사칭, 과금 피로. AStream AS(충전·원장·영수증) 감사 포인트: 무료/유료 경계 명시, 닉네임 중복 정책, 미성년 결제 가드.
- **S7 반응형**: 모바일 탭바+세로스택 / 데스크톱 레일+2컬럼, 룸만 풀스크린 — 감사 포인트: 1024px 경계에서 채팅 사이드바(380px) 깨짐 여부.

## repo 적용 (BOOT-ASTREAM.md로 분리 예정)

1. `.github/workflows/astream-4h.yml`: typecheck + lint + build + test:e2e(./e2e/run.sh)
2. Maestro: Capacitor debug APK → 룸 입장→채팅 1건→리액션 (WWS phone-audit 패턴)
3. 승인 플로우 복사 (design-approve + proposal 템플릿)
