# 3앱 병렬 운영판

실앱을 돌아다니며 테스트 + 4시간 자동화 + 디자인 계속 업데이트 — 앱별로 병렬 진행.

| 앱 | repo | 참고앱 | 스택 (실측) | 자동화 상태 | 실앱 주행 |
|---|---|---|---|---|---|
| WorldWideSomeone | `24h-gambler/WorldWideSomeone` | 젠리·인스타 | Expo RN + Supabase | ✅ 정상궤도 (health+design 초록, 베이스라인 6종 `f99826c`, 이슈 #1–#6 정리완료). 다음 4h부터 감시 모드. 단 `/` 가로 넘침 1건은 실발견 → 다음 실행에서 재등록 예정 | web smoke/full + Maestro 에뮬(매일) |
| LiveLike | `24h-gambler/LiveLlike` | 제타 | 단일 index.html + Capacitor + Supabase · Vercel 배포 | ✅ CI 초록 (run #3, 3m04s: test 5/5·walk 26/26·native 31/31·shots clean) | ✅ 배포 사이트 주행 완료 (카탈로그→삶 상세, 에러 0) |
| Astream | `24h-gambler/Astream` | 스푼 | Next.js 16 + Capacitor + Supabase | ✅ CI 초록 (run #2, 1m20s: typecheck·lint·build) | 미주행 |
| Beff | `minseong-oh/BEFF` | 젠리·제타 | FastAPI + Flutter + Supabase · Oracle VM(beff.life) | ⏳ PR #89 오픈+병합가능. **실행 조건 (minseong-oh 오너만 가능 — 현 세션은 admin 없음 확인): Settings → Actions → General → Allow all actions and reusable workflows → Save** | ✅ 랜딩 주행 완료 (에러 0) · API 200 확인 |

레퍼런스 전수조사: 2026-09-21 크롬 실확인 — 스푼(★3.4)·제타(★3.9·500만DL)·범프(★4.8·Zenly팀)·인스타(★4.65).
결과: `docs/REFS-LIVELIKE.md` · `docs/REFS-BEFF.md` · `docs/REFS-WWS.md`.
참고: 원조 Zenly는 2023년 종료 → 젠리 자리는 범프(amo, Zenly팀)가 대체. 제타=Scatter Lab AI 채팅.

설정: `design.apps.json` (`APP` env로 선택, 기본 worldwidesomeone).

## 접근 부여 (둘 다 private 확인됨 — 2026-09-21)

내 크롬은 네 크롬이 아니라 서버 쪽 별도 브라우저라 네 탭에 못 들어간다. 플러그인·연결 방법도 없다.
비밀번호는 절대 공유 금지. 대신 읽기 전용 토큰으로 자동화에 접근을 준다:

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate
2. Resource owner: 네 계정(두 repo 다 보이는 계정) · 만료 90일 · Repository access: **Only select repositories** → `WorldWideSomeone`, `LiveLlike`, `BEFF` 선택
3. Permissions → **Contents: Read-only**, **Issues: Read-only** (쓰기 자동수정까지 원하면 Contents: Read-write — 나중에)
4. 토큰을 **WWS repo → Settings → Secrets → Actions → `CROSS_REPO_TOKEN`** 에 등록 (이 값은 나한테 절대 보여주지 마)
5. 다음 4h 실행부터 `X 크로스 repo 접근` 스테이지가 3/3을 보고하면 `design.apps.json` 상태를 `active`로 바꾸고 병렬 투입

작동 확인법: Actions 로그에서 `✅ beff — N files` / `✅ livelike — N files` 확인 후,
`reports/cross-repo.json`의 파일 목록(top 20)을 복사해서 나한테 붙여넣으면 Maestro·스모크 문구를 각 앱에 맞게 제작한다.

## LiveLike·Beff 투입 시 복사할 파일 (이 repo → 각 repo)

```
.maestro/*.yaml               # 문구만 각 앱에 맞게 교체
scripts/code-check.mjs        # 제품규칙은 각 앱에 맞게 C-항목만 교체
scripts/backend-check.mjs     # FUNCTIONS 배열만 교체 (그대로도 SKIPPED 동작)
scripts/livelike-check.mjs    # 스모크 스텝의 문구(둘러보기·서울 등)만 교체
scripts/design-check.mjs      # 테마 경로(src/theme)만 맞으면 그대로
scripts/visual-check.mjs      # 그대로 (routes는 design.apps.json)
scripts/run-4h.mjs            # 그대로
design.apps.json              # 해당 앱을 active로
.github/workflows/health-4h.yml
.github/workflows/phone-audit.yml
.github/workflows/design-approve.yml
.github/ISSUE_TEMPLATE/design-proposal.md
docs/DESIGN-AUTO.md · docs/AUTO-4H.md · docs/REFS-*.md
```

각 repo에서 도는 4h 잡은 독립적(병렬)이고, 제안·승인 이슈도 각 repo에 열린다.
크로스앱 비교(예: 베프에 WWS 패턴 이식)는 제안 이슈에 참고 링크로 연결한다.
