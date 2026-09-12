/** 전 세계에 흩어진 봇 유저 60명 (결정적 시드) */
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

const BIOS = [
  '오늘도 하늘을 봅니다', '커피 없이는 못 살아요', '편지 받는 걸 좋아해요', '여행 중 ✈️', '밤에 더 살아있는 사람',
  '고양이 두 마리와 함께', '새로운 사람이 궁금해요', '음악 만드는 중', '조용히 읽고 조용히 답장해요', '지구 반대편에서 안녕',
];

export function makeBots(): User[] {
  seededRandom(20260911);
  const r = seededRandom;
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const bots: User[] = [];
  const usedCities = new Set<number>();
  for (let i = 0; i < 60; i++) {
    let ci = Math.floor(r() * CITIES.length);
    if (usedCities.has(ci) && usedCities.size < CITIES.length) {
      for (let k = 0; k < CITIES.length; k++) {
        ci = (ci + 1) % CITIES.length;
        if (!usedCities.has(ci)) break;
      }
    }
    usedCities.add(ci);
    const c = CITIES[ci];
    const hobbies = Array.from(new Set([pick(HOBBIES), pick(HOBBIES), pick(HOBBIES)])).slice(0, 2 + Math.floor(r() * 2));
    bots.push({
      id: `bot_${i}`,
      nickname: NICKS[i % NICKS.length],
      avatar: pick(AVATARS),
      bio: pick(BIOS),
      field: pick(FIELDS),
      gender: (['female', 'male', 'other', 'private'] as const)[Math.floor(r() * 4)],
      job: pick(JOBS),
      hobbies,
      location: {
        lat: c.lat + (r() - 0.5) * 0.6,
        lng: c.lng + (r() - 0.5) * 0.6,
        city: c.city,
        country: c.country,
      },
      isBot: true,
      lastActiveAt: Date.now() - Math.floor(r() * 3 * 86_400_000),
      stats: { sent: Math.floor(r() * 40), caught: Math.floor(r() * 25), distanceKm: Math.floor(r() * 120_000) },
      stamps: [],
      coins: 0,
      inventory: { shield: 0, ufo: 0, route: 0, orbit: 0 },
      premium: r() < 0.15,
    });
  }
  return bots;
}

/** 봇의 친구 수(커뮤니티 표시용) — 결정적 */
export function botFriendCount(bot: User): number {
  let h = 0;
  for (const ch of bot.id) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return 1 + (h % 40);
}

export const BOT_GREETINGS = [
  '안녕! 네 편지 잡았어. 어디서 보낸 거야?',
  '와, 이게 진짜 여기까지 날아왔네 ✈️',
  '편지 고마워. 나 지금 {city}에 있어!',
  '방금 머리 위로 지나가서 바로 잡았어 ㅎㅎ',
  '오늘 하루 중 가장 신기한 일이야',
];

export const BOT_REPLIES = [
  '진짜? 재밌다 ㅎㅎ',
  '여긴 지금 {weather}. 거기는 어때?',
  '언젠가 {city}에 꼭 가보고 싶어',
  '그 취미 나도 좋아해!',
  '답장 편지도 날려줄게 🛩️',
  '사진 보여줄래?',
  '오늘 뭐 먹었어?',
  '우리 시차가 꽤 나겠다',
  'ㅋㅋㅋ 그럴 줄 알았어',
  '다음엔 UFO로 보내봐, 엄청 빠르대',
];

export const WEATHERS = ['비가 와', '해가 쨍쨍해', '눈이 조금 와', '바람이 세', '흐려', '선선해'];
