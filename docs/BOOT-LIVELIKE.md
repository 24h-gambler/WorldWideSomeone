# BOOT-LIVELIKE — LiveLike repo에 투입할 자동화 (staging 문서, 적용 위치: LiveLike repo root)

실측 기반 (2026-09-21 크롬 실확인 + 배포 사이트 주행):
단일 `app/index.html` 정적 웹 + Capacitor Android + Supabase. 불변식 4개(CLAUDE.md).
기존 스크립트: `build` · `test(tests/run-all.mjs)` · `walk` · `shots` · `native` · `journey` (playwright 이미 있음).
CI 없음(.github 없음). 배포: Vercel(livelike-app.vercel.app) — 2026-09-21 주행 결과 카탈로그→삶 상세 진입 정상, 콘솔에러 0(단, 샌드박스에서 Supabase `ll_events` 2건 터널 차단 — 환경 문제, 실환경 재확인 필요).
**있는 스크립트를 CI에 올리는 게 전부다. 새로 발명하지 않는다.**

## 추가 1: `.github/workflows/livelike-4h.yml` ✅ 초록 (2026-09-21)

run #3 Success 3m04s — test 5/5 · walk 26/26 · native 31/31 · shots clean.
디버그履歴: #1 yaml 오타 → #2 playwright 미설치 실패 → #3 브라우저 설치 후 통과.
issues 자동생성 부활 조건: repo Settings → Actions → Workflow permissions를 Read and write로 변경 (사용자 1클릭, 현재 read-only라 이슈 스텝 제거 상태).

```yaml
name: LiveLike 4H
on:
  schedule: [{cron: "0 */4 * * *"}]
  workflow_dispatch: {inputs: {update_baseline: {type: boolean, default: false}}}
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {ref: claude/job-experience-ai-chat-a2569j} # 기본 브랜치 확정되면 제거
      - uses: actions/setup-node@v4
        with: {node-version: 20, cache: npm}
      - run: npm ci
      - run: npm test            # 불변식·SHAPES 강제 (이 repo의 code-check)
      - run: npm run walk        # 해시 진입 규약
      - run: npm run native      # Capacitor 규약 (entry 복원·statusBar 등)
      - run: npm run shots       # 스크린샷 증거
      - name: 베이스라인 회귀
        run: node <WWS-visual-check-복사본>.mjs  # routes는 해시 라우트(#/play 등)로
      - uses: actions/upload-artifact@v4
        if: always()
        with: {name: livelike-4h-${{ github.run_number }}, path: "reports/\nqa/shots/"}
```

## 추가 2: Maestro (매주, Capacitor debug APK)

`android/` 존재 → `./gradlew assembleDebug` 후 WWS `phone-audit.yml` 동일 패턴.
플로우: 카탈로그→삶 상세→1일차 시작 1건. (문구는 repo 보고 확정)

## 추가 3: 승인 플로우 (복사)

`design-approve.yml` + `design-proposal.md` 복사. refs: 제타.

## 확정 전 필요 정보

1. 기본 브랜치가 `claude/job-experience-ai-chat-a2569j`인지 (위 yaml의 ref 고정용)
2. `shots` 출력 디렉토리 + 베이스라인으로 쓸 기존 샷 유무
3. Supabase URL (BE 도달 확인용, 값 말고 존재 여부만)
