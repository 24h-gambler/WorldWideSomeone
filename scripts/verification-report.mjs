/** docs/screenshots/results.json + 기기 전용 체크리스트 → docs/VERIFICATION.md */
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('docs/screenshots/results.json', 'utf8'));
const shots = fs.readdirSync('docs/screenshots').filter((f) => f.endsWith('.png'));
const shotsFor = (id) => shots.filter((f) => f.startsWith(id + '-') || f.startsWith(id + 'b-')).map((f) => `[${f.replace('.png', '')}](screenshots/${f})`).join(' · ');

const STAGES = [
  { name: '1. 첫 진입 · 온보딩', ids: ['01', '02', '03', '04'], user: '처음 연 사용자가 앱이 무엇인지 10초 안에 이해하고, 프로필과 위치를 2단계로 마친 뒤 살아있는 지구를 본다.' },
  { name: '2. 둘러보기 · 5탭', ids: ['05', '06', '07', '08', '09', '10', '11', '12'], user: '편지·친구·커뮤니티·프로필·상점·설정이 인스타그램 문법으로 익숙하게 읽힌다. 커뮤니티는 ???만 보이고 컨택 가능성이 표시된다.' },
  { name: '3. 첫 편지 보내기', ids: ['13', '14', '15', '16'], user: '편지지에 쓰고 → 목적지를 고르고(랜덤/직접/경유지) → 걷는 배달원(친구 0명)으로 보낸다. 방어권·엽서 공개·받는 사람 조건·컨택%를 확인한다.' },
  { name: '4. 머리 위 통과 → 잡기 / 장난', ids: ['17', '18', '19', '20', '28'], user: '알림(배너)을 탭하면 타이머와 함께 잡기 또는 경로 바꾸기(경유지 1개, 결제 시 2·3개)·달팽이·되돌리기·바다·우주를 고른다. 방어권이 있으면 튕겨나간다.' },
  { name: '5. 답장 → 승인 → 실시간 채팅', ids: ['21', '22', '23', '24', '25', '26'], user: '잡은 편지에 답장(직행·친구 요청 포함)을 보낸다. 승인 전 채팅은 잠겨 있다. 내 편지에 온 답장을 승인하면 친구가 되고 지연 없는 채팅이 열린다.' },
  { name: '6. 요금제 · 결제', ids: ['27'], user: '상점에서 플랜을 비교하고(테스트 결제) 플러스가 되면 경유지가 2개로 늘어난다. 방어권은 친구 5명마다 또는 결제로 얻는다.' },
];

const DEVICE = [
  ['위치 권한 요청 다이얼로그 · "내 위치" 버튼으로 실제 GPS 좌표 → 가장 가까운 도시명', 'expo-location · 설정 화면에 실제 권한 상태 표시', '실기기 필요'],
  ['알림 권한 요청 · 로컬 알림(머리 위 통과) 표시 · 알림 탭 시 잡기 화면으로 이동', 'expo-notifications · subscribeNotificationTaps', '실기기 필요 (Expo Go iOS 가능, Android 는 dev build)'],
  ['원격 푸시(서버 → Expo Push) 수신', 'functions push() + EAS projectId 토큰', 'dev build + Firebase 배포 필요'],
  ['백그라운드 위치 업데이트로 앱 닫힘 상태 통과 알림', 'expo-task-manager + startBackgroundLocation', 'dev build + 항상 허용 권한 필요'],
  ['햅틱 (잡기·버튼)', 'expo-haptics', '실기기 필요'],
  ['사진 첨부 (사진 보관함 권한)', 'expo-image-picker', '실기기 필요 (웹은 파일 선택)'],
  ['스토어 결제 · 구독 갱신 · 웹훅 지급', 'react-native-purchases + revenuecatWebhook', 'dev build + RevenueCat/스토어 샌드박스'],
  ['지구 회전 성능 (저사양 Android)', 'Globe fps prop', '실기기 필요 — 버벅이면 fps 24 → 16'],
];

let md = `# 검증 리포트 (사용자 관점 · 단계별)\n\n`;
md += `- 실행: ${r.at} · 웹 빌드를 390×844(iPhone 14) 뷰포트에서 Playwright 로 자동 주행 · 로컬 시뮬 모드(봇 60명)\n`;
md += `- 결과: **${r.results.filter((x) => x.ok).length}/${r.results.length} 통과** · 콘솔 오류 ${r.errors.length}건\n`;
md += `- 재실행: \`npm run export:web && npx serve dist -l 8081 -s\` → \`BASE=http://localhost:8081 CHROMIUM_PATH=... npm run shots && npm run report\`\n\n`;
for (const st of STAGES) {
  md += `## ${st.name}\n\n> 사용자 입장: ${st.user}\n\n| # | 검증 항목 | 결과 | 증거 |\n|---|---|---|---|\n`;
  for (const id of st.ids) {
    const row = r.results.find((x) => x.id === id);
    if (!row) continue;
    md += `| ${id} | ${row.title} | ${row.ok ? '✅' : `❌ ${row.error ?? ''}`} | ${shotsFor(id)} |\n`;
  }
  md += `\n`;
}
md += `## 7. 실기기에서만 검증 가능한 항목 (체크리스트)\n\n| 항목 | 구현 | 상태 |\n|---|---|---|\n`;
for (const [a, b, c] of DEVICE) md += `| ${a} | ${b} | ⏳ ${c} |\n`;
md += `\n## 8. 서버 모드 검증 (Firebase 배포 후)\n\n| 항목 | 방법 |\n|---|---|\n| 두 기기 A/B 로 A 가 편지 발송 → B(경로 아래) 에 통과 푸시 | tickWorld 로그 · users/B/passbys 문서 생성 확인 |\n| B 가 잡기 → A 에 "잡았어요" 푸시 | catchLetter 콜러블 |\n| B 답장 → A 우편함(delivered) → A 승인 → chats/{A_B} 생성 → 양쪽 friendIds | approveReply |\n| B 가 경로 변경/달팽이 → A 방어권 소모 이벤트 | redirectLetter |\n| RevenueCat 샌드박스 구독 → users/A.plan = plus | revenuecatWebhook |\n| Firestore 규칙: 타인 users_private 읽기 거부 · letters 비참여자 읽기 거부 | 에뮬레이터 규칙 테스트 |\n`;
if (r.errors.length) md += `\n## 콘솔 오류\n\n\`\`\`\n${r.errors.join('\n')}\n\`\`\`\n`;
fs.writeFileSync('docs/VERIFICATION.md', md);
console.log('docs/VERIFICATION.md written');
