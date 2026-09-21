# BOOT-BEFF — BEFF repo에 투입할 자동화 (staging 문서, 적용 위치: BEFF repo root)

실측 기반 (2026-09-21 크롬 실확인): FastAPI(`server.py`) + Flutter(`app/`, screens Funnel/Chat/Map) + Supabase.
CI 일부 존재: `quality-checks.yml`(analyze+test+syntax) · `android-build.yml` · `flutter-build.yml` · `deploy.yml`(SSH→Oracle, beff.life).
**있는 건 안 건드린다. 없는 것만 추가한다.**

## 추가 1: `.github/workflows/beff-4h.yml` (신규, 4시간)

```yaml
name: BEFF 4H
on:
  schedule: [{cron: "0 */4 * * *"}]
  workflow_dispatch: {}
jobs:
  be:
    runs-on: ubuntu-latest
    steps:
      - name: API 생존 (Oracle VM)
        run: curl -fsS https://api.beff.life/ > /dev/null
      - name: Supabase 도달
        env: {SUPABASE_URL: ${{ secrets.SUPABASE_URL }}, SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}}
        run: node -e "fetch(process.env.SUPABASE_URL+'/auth/v1/health').then(r=>{if(r.status!==200)process.exit(1);console.log('auth',r.status)})"
  design:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Maestro smoke (Flutter web?) # web 빌드는 static/ — 아래 phone 잡에서 실기기
        run: echo skip
```

## 추가 2: `.maestro/` (신규, 매주 phone 잡에서 실행)

- `funnel-open.yaml`: launch → 퍼널 진입 assert
- `chat-send.yaml`: 채팅 입력 1건 송신 assert (ecure echo/응답)
- `map-open.yaml`: 지도 탭 진입 assert
- 실행 잡: WWS `phone-audit.yml` 패턴 복사 — `flutter build apk --debug` → emulator → `maestro test`
  (BEFF는 Codemagic iOS도 있으나 CI 실기기는 Android 에뮬로 시작)

## 추가 3: 승인 플로우 (복사)

- `.github/workflows/design-approve.yml` + `.github/ISSUE_TEMPLATE/design-proposal.md` 그대로 복사 (WWS repo에 있음)
- refs: 젠리(범프)·제타 — `docs/REFS-BEFF.md` (WWS repo) 함께 복사

## Secrets (BEFF repo Settings → Secrets → Actions)

| Secret | 용도 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | BE 도달 확인 (이미 있으면 재사용) |

## 확정 전 필요 정보 (파일 목록 붙여넣기)

1. `app/lib` 트리 (테마/토큰 파일 경로 — 디자인 정적검사용)
2. Supabase project ref (BE 체크용, 값 말고 ref만)
3. `app/test` 테스트 수 + `flutter test` 현재 소요시간 (4h 편입 판단용)

위 3개 오면 스크립트 확정본 작성.
