# 4시간 자동화 (BE + FE + LiveLike)

4시간마다 **코드 검정 + 백엔드 생존 + 실앱 사용성**을 돌린다. GitHub Actions와 로컬 스케줄러 둘 다 지원.

```
┌ push ─────────────→ [T1·T2·C] 빠른 검정 (CI)
┌ 4h cron ──────────→ [T1·T2·C·BE·LIVE] 전체 (CI)
┌ 4h 로컬 ──────────→ [T1·T2·C·BE·LIVE] 전체 (PC)
└ 수동 ─────────────→ node scripts/run-4h.mjs [--full]
```

## 1. 무엇을 검사하나 (5 스테이지)

| ID | 이름 | 스크립트 | 내용 |
|---|---|---|---|
| T1 | 타입체크 앱 | `npm run typecheck` | `src/**` tsc |
| T2 | 타입체크 functions | `npm run typecheck:functions` | `supabase/functions/_shared` tsc |
| C | 코드 검정 (FE) | `scripts/code-check.mjs` | 제품규칙 12항: 배달원 43종·클라/서버 상수일치·₩상점only·되돌리기없음·도착시간금지·애플gating·게이트5순간·로그아웃/삭제·받은수만·sim패리티·직행300/환불없음·답장하한 |
| BE | 백엔드 생존 | `scripts/backend-check.mjs` | Auth health·PostgREST·Edge Functions 13개(404=미배포)·users 스키마. secrets 없으면 SKIPPED(로컬시뮬) |
| LIVE | 실앱 사용성 | `scripts/livelike-check.mjs` | 실제 앱 진입 실클릭. `--smoke`(4h 기본 6단계) / `--full`(32단계 전체·nightly) / `--probe`(HTTP만 폴백) |
| D | 디자인 정적 | `scripts/design-check.mjs` | D1 본문명도(FAIL) · D2 보조명도(WARN) · D3 폰트 · D4 줄간격 · D5 하드코딩색 |
| V | 비주얼 회귀 | `scripts/visual-check.mjs` | 6개 라우트 실주행: 베이스라인 대비 픽셀 회귀 0.5% + 가로 넘침 + 탭타겟 + pageerror (`--full`에서만) |

## 2. 실행

```bash
node scripts/code-check.mjs            # 코드 검정만
node scripts/backend-check.mjs         # 백엔드만 (secrets 없으면 skipped)
node scripts/design-check.mjs          # 디자인 정적만 (D1–D5)
node scripts/visual-check.mjs --selftest  # PNG 코덱 자가검증
node scripts/livelike-check.mjs --smoke --base http://localhost:8081
node scripts/livelike-check.mjs --full    # 32단계 (시간 걸림)
node scripts/run-4h.mjs                 # 전체 (스모크)
node scripts/run-4h.mjs --full          # 전체 (풀)
node scripts/run-4h.mjs --skip-livelike # 서버 없는 환경에서
```

웹 대상 띄우기 (LiveLike 로컬):
```bash
npm run export:web && npx serve dist -l 8081 -s   # 터미널 1
BASE=http://localhost:8081 node scripts/livelike-check.mjs --smoke  # 터미널 2
```

실서비스 URL 대상:
```bash
LIVE_URL=https://<배포URL> node scripts/livelike-check.mjs --smoke
```

## 3. GitHub Actions (4시간)

워크플로: `.github/workflows/health-4h.yml` — `0 */4 * * *` + push(빠른검정) + 수동(`full` 옵션).

필요한 Secrets (repo Settings → Secrets → Actions):

| Secret | 용도 | 없으면 |
|---|---|---|
| `SUPABASE_URL` | BE 검사 대상 | BE skipped |
| `SUPABASE_ANON_KEY` | BE 검사 키 | BE skipped |
| `LIVE_URL` | (선택) 배포 URL 있으면 smoke가 live도 같이 봄 | 로컬 export 대상만 |

실패하면 `🚨 4H health 실패` 이슈 자동 생성 + `reports/`·`livelike-*.png` 아티팩트 업로드.

## 4. 로컬 스케줄러 (4시간)

Windows:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/register-4h-task.ps1
node scripts/run-4h.mjs   # 수동 1회
```

mac/Linux:
```bash
bash scripts/schedule-4h.sh
```

## 5. 결과물

- `reports/4h-<ts>.json` + `reports/4h-latest.json` — 전체 요약
- `reports/backend-check.json`, `reports/livelike-check.json`, `reports/visual-check.json`
- `docs/screenshots/baseline/<app>/` — visual 베이스라인 (의도적 변경 후 `--update`로 재생성)
- `docs/screenshots/livelike-*.png` — 실주행 증거 (기존 32단계 `*.png`와 별도 prefix라 안 지워짐)
- `docs/screenshots/results.json` — full 모드일 때만 갱신

## 6. 확장 방법

- 규칙 추가 → `scripts/code-check.mjs`에 `C13` 형태로 추가 (id·title·ok/fail).
- 함수 추가 → `scripts/backend-check.mjs`의 `FUNCTIONS` 배열에 이름 추가.
- 사용성 스텝 추가 → `scripts/livelike-check.mjs` smoke의 `step('L7', …)` 추가.
