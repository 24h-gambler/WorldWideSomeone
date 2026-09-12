/** docs/screenshots/results.json + 기기 전용 체크리스트 → docs/VERIFICATION.md */
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('docs/screenshots/results.json', 'utf8'));
const shots = fs.readdirSync('docs/screenshots').filter((f) => f.endsWith('.png'));
const shotsFor = (id) => shots.filter((f) => new RegExp(`^${id}[a-h]?-`).test(f) && !(id.length === 2 && /^\d\d[a-z]-/.test(f) && r.results.some((x) => x.id === f.slice(0, 3)))).map((f) => `[${f.replace('.png', '')}](screenshots/${f})`).join(' · ');

const STAGES = [
  { name: '1. 첫 진입 · 온보딩', ids: ['01', '02', '03', '04'], user: '처음 연 사용자가 앱이 무엇인지 10초 안에 이해하고, 프로필과 위치를 2단계로 마친 뒤 살아있는 지구를 본다. 지구 위 배달원(커스텀 아이콘)이 실시간으로 움직이고, 경로는 보이지 않는다.' },
  { name: '2. 둘러보기 · 5탭', ids: ['05', '06', '07', '08', '09', '10', '11', '12'], user: '편지·친구·커뮤니티·프로필·상점·설정이 인스타그램 문법으로 읽힌다. 커뮤니티는 국가 없이 km 거리만, 댓글이 붙고, 사람 탭에는 ⚡즉시 친구가 있다. 상점에는 엿보기/끌어오기/즉시 친구 한도가 플랜별로 적혀 있다.' },
  { name: '3. 첫 편지 보내기', ids: ['13', '14', '15', '16'], user: '편지지에 쓰고(스토리 공유 옵션) → 목적지 → 배달원 가족(사람·새·동물·차·기차·배·비행·우주·전설) 중 해금된 것을 고른다. 보내면 내 편지만 경로가 보이고, 포커스를 풀면 다시 숨겨진다.' },
  { name: '4. 머리 위 통과 → 엿보기 · 끌어오기 · 경로 · 잡기', ids: ['17', '18', '18b', '19', '20', '20d', '36'], user: '배너를 탭하면 타이머와 7가지 행동. 무료는 엿보기 한도가 없어 상점으로 안내된다. 잡으면 봉투가 열리고 보낸 사람의 실제 프로필(소개·태그·엽서)과 공유 버튼이 보인다.' },
  { name: '5. 왕복(답장 → 수락 편지 → 확정) → 실시간 채팅', ids: ['21', '22', '23', '24', '25', '26', '27', '28'], user: '답장을 보내면 "왕복 진행 중". 상대 답장이 오면 프로필을 보고 수락 → 수락 편지가 출발 → 상대가 확정하면 친구(왕복 A). 반대로 내 답장을 상대가 수락하면 수락 편지가 내게 오고 내가 확정한다(왕복 B). 그 뒤에만 지연 없는 채팅.' },
  { name: '6. 커뮤니티 · 국가 스토리 · 엽서 · 댓글 · ⚡즉시 친구', ids: ['29', '30', '31'], user: '내 편지를 엽서로 공개하면 피드에는 거리만, 홈 상단 스토리에 국가 대표 사진으로 뜬다. 다른 나라 스토리를 탭해야 엽서 상세에서 국가가 공개된다. 왕복을 건너뛰는 ⚡즉시 친구는 결제(또는 코인)로 요청하고, 거절되면 환불된다.' },
  { name: '7. 유료 플랜 · 엿보기/끌어오기 · 바다', ids: ['32', '33', '34'], user: '플러스가 되면 경유지 2개, 엿보기 3회/일, 끌어오기 1회/일. 지나가는 편지를 엿보고 마음에 들면 내 위치로 끌어온다(편지당 1회, 방어권에 막힘). 바다에 빠뜨리면 몇 시간 멈추고 주인은 코인으로 건져낼 수 있다.' },
  { name: '8. 다크 모드', ids: ['35'], user: '설정에서 시스템/라이트/다크를 고르면 인스타그램 다크 팔레트로 모든 화면과 지구(밤 바다)가 바뀐다.' },
];

const DEVICE = [
  ['위치 권한 요청 다이얼로그 · "내 위치" 버튼으로 실제 GPS 좌표 → 가장 가까운 도시명', 'expo-location · 설정 화면에 실제 권한 상태 표시', '실기기 필요'],
  ['알림 권한 요청 · 로컬 알림(머리 위 통과) 표시 · 알림 탭 시 잡기 화면으로 이동', 'expo-notifications · subscribeNotificationTaps', '실기기 필요 (Expo Go iOS 가능, Android 는 dev build)'],
  ['원격 푸시(서버 → Expo Push) 수신', 'functions push() + EAS projectId 토큰', 'dev build + Firebase 배포 필요'],
  ['백그라운드 위치 업데이트로 앱 닫힘 상태 통과 알림', 'expo-task-manager + startBackgroundLocation', 'dev build + 항상 허용 권한 필요'],
  ['햅틱 (잡기·버튼)', 'expo-haptics', '실기기 필요'],
  ['사진 첨부 (사진 보관함 권한)', 'expo-image-picker', '실기기 필요 (웹은 파일 선택)'],
  ['편지 이미지로 공유 (공유 시트)', 'react-native-view-shot captureRef + expo-sharing', '실기기 필요 (웹은 미지원 안내)'],
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
md += `## 9. 실기기에서만 검증 가능한 항목 (체크리스트)\n\n| 항목 | 구현 | 상태 |\n|---|---|---|\n`;
for (const [a, b, c] of DEVICE) md += `| ${a} | ${b} | ⏳ ${c} |\n`;
md += `\n## 10. 서버 모드 검증 (Firebase 배포 후)\n\n| 항목 | 방법 |\n|---|---|\n| 두 기기 A/B 로 A 가 편지 발송 → B(경로 아래) 에 통과 푸시 | tickWorld 로그 · users/B/passbys 문서 생성 확인 |\n| B 가 잡기 → A 에 "잡았어요" 푸시 | catchLetter 콜러블 |\n| B 답장 → A 우편함(delivered) → A 수락 → 수락 편지 → B 확정 → chats/{A_B} 생성 → 양쪽 friendIds | approveReply (reply→accept 편지, accept→friends) |\n| B 가 엿보기/끌어오기 → 한도 차감 · A 방어권 소모 · 편지 destination 변경 | redirectLetter(peek/pull) |\n| 바다 추락 → sunkUntil 후 tickWorld 가 재부상 · rescueLetter 로 즉시 재개 | tickWorld / rescueLetter |\n| ⚡즉시 친구 요청 → 상대 응답 → 친구 또는 환불 | requestInstantFriend / answerInstantFriend |\n| B 가 경로 변경/달팽이 → A 방어권 소모 이벤트 | redirectLetter |\n| RevenueCat 샌드박스 구독 → users/A.plan = plus | revenuecatWebhook |\n| Firestore 규칙: 타인 users_private 읽기 거부 · letters 비참여자 읽기 거부 | 에뮬레이터 규칙 테스트 |\n`;
if (r.errors.length) md += `\n## 콘솔 오류\n\n\`\`\`\n${r.errors.join('\n')}\n\`\`\`\n`;
fs.writeFileSync('docs/VERIFICATION.md', md);
console.log('docs/VERIFICATION.md written');
