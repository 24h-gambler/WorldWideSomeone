# 소개 페이지 배포 (site/)

## 파일
- `index.html` — 앱 소개 랜딩 (운동 동기 부족·정서 돌봄 앵글)
- `privacy.html` — 개인정보처리방침 (스토어·OAuth 공용)
- `terms.html` — 이용약관

## 확정 주소 (wws.worldwidesomething.com — CNAME 푸시됨, DNS 대기)
| 용도 | URL |
|---|---|
| 소개 랜딩 | `https://wws.worldwidesomething.com/` (gh-pages 브랜치) |
| 개인정보처리방침 | `https://wws.worldwidesomething.com/privacy.html` |
| 이용약관 | `https://wws.worldwidesomething.com/terms.html` |
| 회사사이트 삽입 | `site/company-insert.html` (리스트 li + 상세 카피, Next.js 소스에 붙여넣기)

※ DNS에 `wws` CNAME 등록 전까지 사이트 접속 불가. 등록은 도메인 관리사에서.

위 URL이 확정되면 아래에 그대로 입력 (OAuth·스토어 공용):
- Google 브랜딩: 홈페이지·개인정보처리방침·약관 링크
- App Store 앱 정보: 개인정보처리방침 URL
- Play 데이터 보안: 개인정보처리방침 URL
- Kakao 동의항목 하단 고지용 서비스 약관 URL

## 배포 방법 (택 1)
1. **가비아 웹호스팅** (61.41.153.2 응답 IP가 가비아로 보임): 하위 도메인 추가 → `site/` 3개 파일 업로드
2. **Vercel/Cloudflare Pages**: `site/` 드래그 업로드 → 도메인 연결
3. 배포 후 `https://app.worldwidesomeone.app/privacy.html` 접속 확인

## DNS (도메인 관리사에서)
- `app` A 레코드 → 호스팅 IP (또는 CNAME → 호스팅 제공 주소)
- HTTPS 인증서 자동 발급 확인
