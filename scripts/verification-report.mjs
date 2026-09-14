/** docs/screenshots/results.json + 기기 전용 체크리스트 → docs/VERIFICATION.md */
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('docs/screenshots/results.json', 'utf8'));
const shots = fs.readdirSync('docs/screenshots').filter((f) => f.endsWith('.png'));
const shotsFor = (id) => shots.filter((f) => new RegExp(`^${id}[a-h]?-`).test(f) && !(id.length === 2 && /^\d\d[a-z]-/.test(f) && r.results.some((x) => x.id === f.slice(0, 3)))).map((f) => `[${f.replace('.png', '')}](screenshots/${f})`).join(' · ');

const STAGES = [
  { name: '1. 첫 진입 · 비회원 · 투어', ids: ['01', '02', '03', '04'], user: '가입 없이 환영 화면에서 바로 지구로 들어간다. 투어가 한 군데씩 짧은 CTA 로 안내하고 마지막에 편지 쓰기로 이어진다. 착륙한 편지는 남에게 보이지 않는다.' },
  { name: '2. 비회원 둘러보기 · 5탭', ids: ['05', '06', '07', '08', '09', '10', '11'], user: '편지·친구·커뮤니티·프로필·상점·설정을 비회원으로 본다. 원화는 상점의 코인 팩에서만 보이고 나머지는 전부 SC. 커뮤니티는 받은 편지 수와 거리만.' },
  { name: '3. 가입 게이트 → 첫 편지', ids: ['12', '13'], user: '편지를 다 쓰고 보내기를 누르는 순간에만 SNS 가입 시트가 뜬다(Apple·Google·카카오 · 나중에 가능). 가입하면 바로 발송되고 홈에는 속도·거리만(도착 시간 없음).' },
  { name: '4. 머리 위 통과 → 엿보기 · 끌어오기 · 경로 · 침수 · 잡기', ids: ['14', '15', '16', '17', '18', '32'], user: '되돌리기는 없다. 침수·우주·달팽이·경로·엿보기·끌어오기. 잡으면 보낸 사람의 실제 프로필과 공유 버튼.' },
  { name: '5. 왕복(내 편지 → 상대 답장) · 코인 가속 → 수락 → 채팅', ids: ['19', '20', '21', '22'], user: '오는 답장은 속도와 나와의 거리만 보인다. 느리면 SC 로 4배/1분 가속. 도착하면 수락 → 친구 + 실시간 채팅. 친구는 홈 지구에 50km 원으로.' },
  { name: '6. 커뮤니티 · 국가 스토리 · 댓글 · ⚡ 직행 편지', ids: ['23', '24', '25'], user: '엽서 공개 → 홈 스토리(국가는 탭해야) → 댓글. 직행 편지는 300 SC 로 그 사람에게 무조건 도착, 환불 없음.' },
  { name: '7. 플랜 · 대여 · 플러스 엿보기/끌어오기 · 침수', ids: ['26', '27', '28', '29'], user: '플랜은 매월 SC 와 한도·할인. 잠긴 배달원은 SC 로 1회 대여. 침수는 몇 시간 정지, 주인은 SC 로 구조.' },
  { name: '8. 다크 모드 · 트래킹', ids: ['30', '31'], user: '인스타 다크 팔레트. 비회원 시점부터 화면·버튼·스크롤·게이트·가입 이벤트가 전부 기록된다.' },
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
md += `\n## 10. 서버 모드 검증 (Supabase 배포 후)\n\n| 항목 | 방법 |\n|---|---|\n| 두 기기 A/B 로 A 가 편지 발송 → B(경로 아래) 에 통과 푸시 | tickWorld 로그 · users/B/passbys 문서 생성 확인 |\n| B 가 잡기 → A 에 "잡았어요" 푸시 | catchLetter 콜러블 |\n| B 답장 → A 우편함(delivered) → A 수락 → chats 생성 → 양쪽 friend_ids | approve-reply |\n| A 가 오는 답장을 SC 로 가속 → arrives_at 단축 · coin_ledger 기록 | boost-reply |\n| B 가 엿보기/끌어오기 → 한도 차감 · A 방어권 소모 · 편지 destination 변경 | redirectLetter(peek/pull) |\n| 바다 추락 → sunkUntil 후 tickWorld 가 재부상 · rescueLetter 로 즉시 재개 | tickWorld / rescueLetter |\n| ⚡즉시 친구 요청 → 상대 응답 → 친구 또는 환불 | requestInstantFriend / answerInstantFriend |\n| B 가 경로 변경/달팽이 → A 방어권 소모 이벤트 | redirectLetter |\n| RevenueCat 샌드박스 코인 팩/플랜 → purchases(중복 방지) · users.coins/plan | purchase-webhook |\n| 통과 판정 셀 조인 · 핫셀 샘플 · 편지당 상한 · 푸시 하루 12건/조용한 시간 | tick-world · push-dispatch (docs/SCALE.md) |\n| 트래킹 배치 → events (비회원 포함) | track-events |\n| RLS: users_private 아무도 못 읽음 · letters 비참여자 거부 · 게임 필드 클라이언트 수정 차단(트리거) | supabase/tests/rls.sql |\n`;
if (r.errors.length) md += `\n## 콘솔 오류\n\n\`\`\`\n${r.errors.join('\n')}\n\`\`\`\n`;
fs.writeFileSync('docs/VERIFICATION.md', md);
console.log('docs/VERIFICATION.md written');
