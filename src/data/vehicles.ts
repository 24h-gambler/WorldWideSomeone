import type { VehicleId } from '@/types';

/**
 * 배달원 카탈로그 — 사람 → 동물/새 → 육상 → 해상 → 항공 → 우주/특수. 친구 수(또는 결제/이벤트)로 해금.
 * 속도는 시뮬 km/h (체감 = 속도 × 배속). 아이콘은 src/components/vehicle-art.tsx 자체 디자인.
 */
export type Family = 'human' | 'animal' | 'bird' | 'ground' | 'sea' | 'air' | 'space' | 'fantasy';
export type Vehicle = {
  id: VehicleId; name: string; family: Family; speedKmh: number;
  unlockFriends: number | null; premiumItem?: 'ufo' | 'orbit' | 'dragon' | 'carpet' | 'event';
  desc: string; trait?: string; color: string; catchWindowMultiplier: number;
  motion: 'straight' | 'drift' | 'zigzag' | 'orbit';
  immune?: boolean; immuneOcean?: boolean; immuneSnail?: boolean; builtInShield?: boolean;
};

export const FAMILY_LABEL: Record<Family, string> = { human: '사람', animal: '동물', bird: '새', ground: '육상', sea: '해상', air: '항공', space: '우주', fantasy: '판타지' };

export const VEHICLES: Vehicle[] = [
  // 사람
  { id: 'walk', name: '걷는 배달원', family: 'human', speedKmh: 5, unlockFriends: 0, desc: '느리지만 확실하게. 첫 편지는 걸어서 갑니다.', color: '#8E8E8E', catchWindowMultiplier: 1.4, motion: 'drift' },
  { id: 'jog', name: '조깅 배달원', family: 'human', speedKmh: 9, unlockFriends: 1, desc: '땀 좀 흘리는 배달원.', color: '#FF9F43', catchWindowMultiplier: 1.3, motion: 'drift' },
  { id: 'run', name: '스프린터', family: 'human', speedKmh: 16, unlockFriends: 2, desc: '전력질주. 사람 중 가장 빠릅니다.', color: '#FF5A5F', catchWindowMultiplier: 1.2, motion: 'straight' },
  // 육상 · 사람 동력
  { id: 'kick', name: '킥보드', family: 'ground', speedKmh: 15, unlockFriends: 2, desc: '골목을 누비는 킥보드.', color: '#06D6A0', catchWindowMultiplier: 1.2, motion: 'straight' },
  { id: 'bike', name: '자전거', family: 'ground', speedKmh: 25, unlockFriends: 3, desc: '페달을 밟으면 대륙도 건너요.', color: '#118AB2', catchWindowMultiplier: 1.1, motion: 'straight' },
  // 새 (작은 새 → 큰 새)
  { id: 'pigeon', name: '비둘기', family: 'bird', speedKmh: 60, unlockFriends: 4, desc: '전서구의 후예. 도시 위를 낮게 납니다.', color: '#B0B7C3', catchWindowMultiplier: 1.1, motion: 'drift' },
  { id: 'seagull', name: '갈매기', family: 'bird', speedKmh: 70, unlockFriends: 5, desc: '바다 위에서 더 빨라요.', trait: '바다 위 속도 +20%', color: '#FFFFFF', catchWindowMultiplier: 1.1, motion: 'drift' },
  { id: 'goose', name: '기러기', family: 'bird', speedKmh: 80, unlockFriends: 7, desc: 'V자 대형으로 멀리 갑니다.', color: '#8D5B3E', catchWindowMultiplier: 1, motion: 'straight' },
  { id: 'crane', name: '두루미', family: 'bird', speedKmh: 85, unlockFriends: 9, desc: '우아하게, 오래.', color: '#F4F6FF', catchWindowMultiplier: 1, motion: 'drift' },
  { id: 'hawk', name: '매', family: 'bird', speedKmh: 130, unlockFriends: 12, desc: '급강하로 목적지를 노립니다.', trait: '잡기 창 −20%', color: '#A0522D', catchWindowMultiplier: 0.8, motion: 'straight' },
  { id: 'eagle', name: '독수리', family: 'bird', speedKmh: 150, unlockFriends: 15, desc: '하늘의 왕. 달팽이가 안 붙어요.', trait: '🐌 면역', color: '#5A3A1E', catchWindowMultiplier: 0.9, motion: 'straight', immuneSnail: true },
  { id: 'albatross', name: '앨버트로스', family: 'bird', speedKmh: 140, unlockFriends: 18, desc: '지구에서 가장 멀리 나는 새. 표류하지 않아요.', trait: '직진 · 장거리', color: '#DDE3EA', catchWindowMultiplier: 1, motion: 'straight' },
  // 동물
  { id: 'horse', name: '말', family: 'animal', speedKmh: 45, unlockFriends: 6, desc: '옛날 우편 방식 그대로.', color: '#B0713A', catchWindowMultiplier: 1, motion: 'drift' },
  { id: 'camel', name: '낙타', family: 'animal', speedKmh: 40, unlockFriends: 8, desc: '사막을 건너는 인내.', trait: '바다에 빠지면 1시간 만에 부상', color: '#D2A05A', catchWindowMultiplier: 1.1, motion: 'drift' },
  { id: 'dolphin', name: '돌고래', family: 'animal', speedKmh: 55, unlockFriends: 10, desc: '바다에 빠뜨릴 수 없어요. 원래 거기 살아요.', trait: '🌊 면역', color: '#5AC8FA', catchWindowMultiplier: 1, motion: 'drift', immuneOcean: true },
  { id: 'cheetah', name: '치타', family: 'animal', speedKmh: 110, unlockFriends: 14, desc: '육상 최고 속도. 금방 지칩니다.', trait: '잡기 창 −10%', color: '#E5B25D', catchWindowMultiplier: 0.9, motion: 'straight' },
  // 육상 · 엔진
  { id: 'scooter', name: '스쿠터', family: 'ground', speedKmh: 60, unlockFriends: 11, desc: '도시 배달의 정석.', color: '#FF7AB6', catchWindowMultiplier: 1, motion: 'straight' },
  { id: 'kei', name: '경차', family: 'ground', speedKmh: 90, unlockFriends: 13, desc: '작고 알뜰한 첫 차.', color: '#FFD166', catchWindowMultiplier: 1, motion: 'straight' },
  { id: 'bus', name: '버스', family: 'ground', speedKmh: 80, unlockFriends: 16, desc: '여러 사람 머리 위를 천천히.', trait: '잡기 창 +30%', color: '#06D6A0', catchWindowMultiplier: 1.3, motion: 'straight' },
  { id: 'sedan', name: '세단', family: 'ground', speedKmh: 120, unlockFriends: 19, desc: '고속도로 로드트립.', color: '#4F5BD5', catchWindowMultiplier: 0.9, motion: 'straight' },
  { id: 'truck', name: '트럭', family: 'ground', speedKmh: 95, unlockFriends: 21, desc: '큰 짐도 거뜬. 방어권 1개 내장.', trait: '🛡️ 내장', color: '#FF9F43', catchWindowMultiplier: 1, motion: 'straight', builtInShield: true },
  { id: 'sports', name: '스포츠카', family: 'ground', speedKmh: 260, unlockFriends: 25, desc: '빨간 스포츠카. 눈 깜짝할 새 지나갑니다.', trait: '잡기 창 −30%', color: '#E63946', catchWindowMultiplier: 0.7, motion: 'straight' },
  { id: 'train', name: '기차', family: 'ground', speedKmh: 160, unlockFriends: 23, desc: '정시 출발.', color: '#2D3142', catchWindowMultiplier: 0.9, motion: 'straight' },
  { id: 'ktx', name: '고속열차', family: 'ground', speedKmh: 300, unlockFriends: 30, desc: '대륙을 몇 시간 만에.', color: '#7B61FF', catchWindowMultiplier: 0.8, motion: 'straight' },
  { id: 'maglev', name: '자기부상열차', family: 'ground', speedKmh: 430, unlockFriends: 36, desc: '레일 위를 떠서 달립니다.', color: '#118AB2', catchWindowMultiplier: 0.8, motion: 'straight' },
  // 해상
  { id: 'sail', name: '요트', family: 'sea', speedKmh: 20, unlockFriends: 5, desc: '바람 따라 표류. 바다에 빠져도 금방 떠요.', trait: '🌊 1시간 만에 부상', color: '#FFFFFF', catchWindowMultiplier: 1.3, motion: 'drift' },
  { id: 'speedboat', name: '스피드보트', family: 'sea', speedKmh: 75, unlockFriends: 12, desc: '물살을 가르며.', color: '#5AC8FA', catchWindowMultiplier: 1, motion: 'straight' },
  { id: 'cruise', name: '크루즈', family: 'sea', speedKmh: 45, unlockFriends: 17, desc: '천천히, 많은 사람 위로. 방어권 내장.', trait: '🛡️ 내장 · 잡기 창 +40%', color: '#F4F6FF', catchWindowMultiplier: 1.4, motion: 'drift', builtInShield: true },
  { id: 'submarine', name: '잠수함', family: 'sea', speedKmh: 40, unlockFriends: 22, desc: '바다에 빠뜨릴 수 없고, 엿보기도 안 돼요.', trait: '🌊 면역 · 🔍 면역', color: '#073B4C', catchWindowMultiplier: 1.1, motion: 'straight', immuneOcean: true },
  { id: 'hover', name: '호버크래프트', family: 'sea', speedKmh: 90, unlockFriends: 27, desc: '땅도 바다도 미끄러지듯.', color: '#06D6A0', catchWindowMultiplier: 1, motion: 'drift' },
  // 항공
  { id: 'balloon', name: '열기구', family: 'air', speedKmh: 30, unlockFriends: 8, desc: '넓게 표류해 더 많은 사람을 만나요.', trait: '잡기 창 +60%', color: '#FF5A5F', catchWindowMultiplier: 1.6, motion: 'drift' },
  { id: 'paraglider', name: '패러글라이더', family: 'air', speedKmh: 40, unlockFriends: 10, desc: '바람을 타고 유유히.', color: '#FFD166', catchWindowMultiplier: 1.3, motion: 'drift' },
  { id: 'heli', name: '헬리콥터', family: 'air', speedKmh: 250, unlockFriends: 24, desc: '어디든 착륙.', color: '#FF9F43', catchWindowMultiplier: 1, motion: 'straight' },
  { id: 'prop', name: '프로펠러기', family: 'air', speedKmh: 350, unlockFriends: 28, desc: '클래식한 소형기.', color: '#5AC8FA', catchWindowMultiplier: 0.9, motion: 'straight' },
  { id: 'airliner', name: '여객기', family: 'air', speedKmh: 900, unlockFriends: 40, desc: '하루 안에 지구 반대편.', color: '#FFFFFF', catchWindowMultiplier: 0.8, motion: 'straight' },
  { id: 'fighter', name: '전투기', family: 'air', speedKmh: 2000, unlockFriends: 50, desc: '음속 돌파. 달팽이 면역.', trait: '🐌 면역 · 잡기 창 −30%', color: '#2D3142', catchWindowMultiplier: 0.7, motion: 'straight', immuneSnail: true },
  { id: 'concorde', name: '콩코드', family: 'air', speedKmh: 2200, unlockFriends: 55, desc: '전설의 초음속 여객기.', color: '#F4F6FF', catchWindowMultiplier: 0.7, motion: 'straight' },
  // 우주
  { id: 'rocket', name: '로켓', family: 'space', speedKmh: 6000, unlockFriends: 60, desc: '불꽃을 남기며 순식간에.', color: '#E63946', catchWindowMultiplier: 0.7, motion: 'straight' },
  { id: 'satellite', name: '궤도 위성', family: 'space', speedKmh: 28000, unlockFriends: null, premiumItem: 'orbit', desc: '지구를 3바퀴 돌고 착륙. 최대 노출.', color: '#FFD166', catchWindowMultiplier: 1.5, motion: 'orbit' },
  { id: 'ufo', name: 'UFO', family: 'space', speedKmh: 12000, unlockFriends: null, premiumItem: 'ufo', desc: '지그재그 · 잡기 창 2배 · 모두의 시선.', color: '#06D6A0', catchWindowMultiplier: 2.2, motion: 'zigzag' },
  // 판타지
  { id: 'carpet', name: '마법 양탄자', family: 'fantasy', speedKmh: 800, unlockFriends: null, premiumItem: 'carpet', desc: '엿보기 면역. 소원은 안 들어줘요.', trait: '🔍 면역', color: '#7B61FF', catchWindowMultiplier: 1.2, motion: 'drift' },
  { id: 'unicorn', name: '유니콘', family: 'fantasy', speedKmh: 500, unlockFriends: null, premiumItem: 'event', desc: '시즌 이벤트 한정.', color: '#FF7AB6', catchWindowMultiplier: 1.2, motion: 'drift' },
  { id: 'dragon', name: '드래곤', family: 'fantasy', speedKmh: 2500, unlockFriends: 80, premiumItem: 'dragon', desc: '모든 장난 면역. 친구 80명 또는 프로.', trait: '전체 면역', color: '#06D6A0', catchWindowMultiplier: 1.2, motion: 'drift', immune: true, immuneOcean: true, immuneSnail: true },
];

export const SNAIL = { name: '달팽이', factor: 0.1, durationMs: 5 * 60_000 } as const;
export const VEHICLE_MAP: Record<VehicleId, Vehicle> = Object.fromEntries(VEHICLES.map((v) => [v.id, v])) as Record<VehicleId, Vehicle>;
export const FAMILIES: Family[] = ['human', 'ground', 'bird', 'animal', 'sea', 'air', 'space', 'fantasy'];

export function vehicleUnlocked(v: Vehicle, friendCount: number, inventory: { ufo: number; orbit: number; carpet?: number }, plan: PlanId): boolean {
  if (v.premiumItem === 'ufo') return inventory.ufo > 0;
  if (v.premiumItem === 'orbit') return inventory.orbit > 0;
  if (v.premiumItem === 'carpet') return (inventory.carpet ?? 0) > 0 || plan === 'pro';
  if (v.premiumItem === 'event') return false;
  if (v.premiumItem === 'dragon') return plan === 'pro' || friendCount >= (v.unlockFriends ?? Infinity);
  const boost = plan === 'pro' ? 10 : plan === 'plus' ? 4 : 0;
  return v.unlockFriends !== null && friendCount + boost >= v.unlockFriends;
}
export function bestVehicle(friendCount: number, inventory: { ufo: number; orbit: number }, plan: PlanId): VehicleId {
  const ok = VEHICLES.filter((v) => !v.premiumItem && vehicleUnlocked(v, friendCount, inventory, plan)).sort((a, b) => a.speedKmh - b.speedKmh);
  return ok[ok.length - 1]?.id ?? 'walk';
}
export function fastestOwned(friendCount: number, inventory: { ufo: number; orbit: number }, plan: PlanId): VehicleId {
  const ok = VEHICLES.filter((v) => vehicleUnlocked(v, friendCount, inventory, plan) && v.motion !== 'orbit').sort((a, b) => a.speedKmh - b.speedKmh);
  return ok[ok.length - 1]?.id ?? 'walk';
}
export function nextUnlock(friendCount: number, plan: PlanId): Vehicle | undefined {
  const boost = plan === 'pro' ? 10 : plan === 'plus' ? 4 : 0;
  return VEHICLES.filter((v) => v.unlockFriends !== null && !v.premiumItem && v.unlockFriends > friendCount + boost).sort((a, b) => (a.unlockFriends ?? 0) - (b.unlockFriends ?? 0))[0];
}
type PlanId = 'free' | 'plus' | 'pro';
