/** 전 세계에 흩어진 봇 유저 60명 + 커뮤니티 시드 텍스트 (결정적 시드) */
import type { User } from '@/types';
import { CITIES } from './cities';
import { AVATARS, FIELDS, HOBBIES, JOBS } from './profile';
import { seededRandom } from '@/engine/geo';

const NICKS = [
  'moonwalker', 'sora', 'pixelpine', 'lunaluna', 'kairo', 'nomad_jo', 'tofu', 'ember', 'wavey', 'nori',
  'zephyr', 'mila_k', 'saltwater', 'yuki', 'orbit', 'cloudberry', 'dune', 'juno', 'peach', 'atlas',
  'rio', 'fern', 'koa', 'birdie', 'noor', 'echo', 'sunny', 'mochi', 'kite', 'indigo',
  'hazel', 'pablo', 'lotte', 'minji', 'theo', 'ana', 'ravi', 'lea', 'tomo', 'chai',
  'aria', 'leo', 'nova', 'iris', 'sage', 'remy', 'olive', 'finn', 'mira', 'kenji',
  'zara', 'omar', 'lily', 'hugo', 'nina', 'ezra', 'ines', 'yara', 'dami', 'suki',
];
const BIOS = ['오늘도 하늘을 봅니다', '커피 없이는 못 살아요', '편지 받는 걸 좋아해요', '여행 중 ✈️', '밤에 더 살아있는 사람', '고양이 두 마리와 함께', '새로운 사람이 궁금해요', '음악 만드는 중', '조용히 읽고 조용히 답장해요', '지구 반대편에서 안녕'];

export function makeBots(): User[] {
  seededRandom(20260911);
  const r = seededRandom;
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const bots: User[] = [];
  const used = new Set<number>();
  for (let i = 0; i < 60; i++) {
    let ci = Math.floor(r() * CITIES.length);
    if (used.has(ci)) for (let k = 0; k < CITIES.length; k++) { ci = (ci + 1) % CITIES.length; if (!used.has(ci)) break; }
    used.add(ci);
    const c = CITIES[ci];
    const hobbies = Array.from(new Set([pick(HOBBIES), pick(HOBBIES), pick(HOBBIES)])).slice(0, 2 + Math.floor(r() * 2));
    const plan = r() < 0.1 ? 'pro' : r() < 0.3 ? 'plus' : 'free';
    bots.push({
      id: `bot_${i}`,
      nickname: NICKS[i % NICKS.length],
      avatar: pick(AVATARS),
      bio: pick(BIOS),
      field: pick(FIELDS),
      gender: (['female', 'male', 'other', 'private'] as const)[Math.floor(r() * 4)],
      job: pick(JOBS),
      hobbies,
      location: { lat: c.lat + (r() - 0.5) * 0.6, lng: c.lng + (r() - 0.5) * 0.6, city: c.city, country: c.country },
      isBot: true,
      lastActiveAt: Date.now() - Math.floor(r() * 3 * 86_400_000),
      stats: { sent: Math.floor(r() * 60), caught: Math.floor(r() * 40), distanceKm: Math.floor(r() * 160_000), likes: Math.floor(r() * 300) },
      stamps: [],
      coins: 0,
      inventory: { shield: 0, ufo: 0, orbit: 0, peek: 0, pull: 0, instant: 0, carpet: 0 },
      quota: { date: '', peeks: 0, pulls: 0, instant: 0 },
      plan,
      shieldMilestone: 0,
      createdAt: Date.now() - Math.floor(r() * 90 * 86_400_000),
    });
  }
  return bots;
}

export function botFriendCount(bot: User): number {
  let h = 0;
  for (const ch of bot.id) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return 1 + (h % 60);
}

export const BOT_LETTERS = [
  '지금 이 편지를 읽는 당신, 오늘 하루 어땠나요?',
  '여기 하늘은 오렌지색이에요. 거기는요?',
  '아무나 잡아줘요. 심심해요.',
  '나는 새벽에 이걸 썼어요. 누구에게 갈지 궁금하네요.',
  '만약 이걸 잡았다면, 당신은 운이 좋은 사람.',
  '커피 한 잔 값의 용기로 보냅니다 ☕',
  '내 고양이가 방금 이 위를 지나갔어요. 발자국이 있다면 그거예요.',
  '우리 언제 한번 만날 수 있을까요? 아니면 편지로만.',
  '오늘 처음으로 바다를 봤어요. 당신은 바다 근처에 사나요?',
  '이 도시는 밤 11시에 가장 예뻐요. 언젠가 보여주고 싶어요.',
  '방금 시험 끝났어요. 축하해줄 사람이 필요해요.',
  '요즘 무슨 노래 들어요? 추천해줘요.',
];

export const BOT_REPLIES_LETTER = [
  '편지 잘 받았어요! 여기까지 날아온 게 신기해요. 우리 친구 해요.',
  '머리 위로 지나가길래 잡았어요 ㅎㅎ 답장 보내요. 승인해줄래요?',
  '당신 편지 덕분에 오늘 웃었어요. 이제 실시간으로 얘기해봐요.',
  '나도 같은 취미예요! 친구가 되면 더 얘기하고 싶어요.',
];

export const BOT_GREETINGS = [
  '안녕! 드디어 실시간이네 ✈️',
  '와, 편지가 진짜 여기까지 왔어.',
  '나 지금 {city}야. 거긴 몇 시야?',
  '승인 고마워! 오늘 하루 어땠어?',
];

export const BOT_REPLIES = [
  '진짜? 재밌다 ㅎㅎ', '여긴 지금 {weather}. 거기는 어때?', '언젠가 {city}에 꼭 와봐', '그 취미 나도 좋아해!', '다음엔 더 빠른 걸로 보내줘 🚀',
  '사진 보여줄래?', '오늘 뭐 먹었어?', '우리 시차가 꽤 나겠다', 'ㅋㅋㅋ 그럴 줄 알았어', '커뮤니티에 엽서 올려봐, 내가 좋아요 누를게',
];
export const WEATHERS = ['비가 와', '해가 쨍쨍해', '눈이 조금 와', '바람이 세', '흐려', '선선해'];

export const BOT_POSTS = [
  '이 엽서는 걸어서 3,000km를 왔어요. 잡아준 사람 고마워요.',
  '첫 편지가 도쿄에서 잡혔어요 🎉 이제 친구 2명!',
  '오늘 머리 위로 UFO가 지나갔는데 놓쳤어요… 다음엔 꼭.',
  '지구 반대편 친구랑 새벽 3시에 채팅 중. 이게 되네요.',
  '스탬프 12개 모았어요. 다음 목표는 남미!',
  '누가 내 편지를 바다에 빠뜨렸어요 🌊 방어권 사야겠다.',
  '자전거 해금! 이제 대륙 건너는 데 하루면 돼요.',
  '조건을 "디자인"으로 걸었더니 진짜 디자이너가 잡았어요.',
  '착륙한 편지를 집어갔더니 사진이 들어있었어요. 그 도시 야경.',
  '경로 바꾸기로 내 친구 머리 위로 보내줬어요. 잡았대요 ㅋㅋ',
];

export const BOT_COMMENTS = ['여기 어디예요? 분위기 좋다', '저도 이 배달원 써봤는데 진짜 느려요 ㅋㅋ', '편지 보내도 돼요?', '몇 km 떨어져 있는지 보니까 꽤 머네요', '사진 예뻐요 📸', '다음 편지는 제 머리 위로 보내주세요', '좋아요 눌렀어요!', '이 도시 가보고 싶다'];
export const BOT_ACCEPT_LETTERS = ['답장 고마워요. 프로필 보니 좋은 사람 같아서 수락할게요. 이 편지가 도착하면 확정해줘요!', '왕복 완료! 이제 실시간으로 얘기해요. 도착하면 확정 눌러줘요.', '당신 엽서도 봤어요. 친구 해요 — 확정 버튼은 그쪽 차례!'];
