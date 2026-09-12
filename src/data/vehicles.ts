import type { VehicleId } from '@/types';

/**
 * 운송수단 진행: 사람(느림)부터 시작해 친구 수로 빨라진다. 달팽이는 벌칙 상태(일시).
 * 속도는 시뮬 km/h. 실제 체감 = 속도 × timeScale (기본 240 → 걷기 5km/h는 실제 1,200km/h → 서울→도쿄 약 1시간)
 */
export type Vehicle = {
  id: VehicleId;
  name: string;
  emoji: string;
  speedKmh: number;
  unlockFriends: number | null; // null = 결제/프리미엄 전용
  premiumItem?: 'ufo' | 'orbit' | 'dragon';
  desc: string;
  color: string;
  catchWindowMultiplier: number;
  motion: 'straight' | 'drift' | 'zigzag' | 'orbit';
  immune?: boolean;
  tier: 'human' | 'ground' | 'air' | 'space' | 'special';
};

export const VEHICLES: Vehicle[] = [
  { id: 'walk', name: '걷는 배달원', emoji: '🚶', speedKmh: 5, unlockFriends: 0, desc: '느리지만 확실하게. 첫 편지는 걸어서 갑니다.', color: '#8E8E8E', catchWindowMultiplier: 1.4, motion: 'drift', tier: 'human' },
  { id: 'jog', name: '조깅 배달원', emoji: '🏃', speedKmh: 10, unlockFriends: 2, desc: '두 배 빠른 사람. 땀은 좀 흘려요.', color: '#FA7E1E', catchWindowMultiplier: 1.3, motion: 'drift', tier: 'human' },
  { id: 'sprint', name: '스프린터', emoji: '🏃‍♀️', speedKmh: 18, unlockFriends: 5, desc: '전력질주. 사람 중 가장 빠른 배달원.', color: '#D62976', catchWindowMultiplier: 1.2, motion: 'straight', tier: 'human' },
  { id: 'bike', name: '자전거', emoji: '🚴', speedKmh: 25, unlockFriends: 8, desc: '페달을 밟으면 대륙도 건너요.', color: '#2DBE60', catchWindowMultiplier: 1.1, motion: 'straight', tier: 'ground' },
  { id: 'horse', name: '말', emoji: '🏇', speedKmh: 45, unlockFriends: 12, desc: '옛날 우편 방식 그대로.', color: '#B0713A', catchWindowMultiplier: 1, motion: 'drift', tier: 'ground' },
  { id: 'scooter', name: '스쿠터', emoji: '🛵', speedKmh: 70, unlockFriends: 16, desc: '도시를 가로지르는 배달의 정석.', color: '#0095F6', catchWindowMultiplier: 1, motion: 'straight', tier: 'ground' },
  { id: 'car', name: '자동차', emoji: '🚗', speedKmh: 120, unlockFriends: 22, desc: '고속도로 로드트립.', color: '#4F5BD5', catchWindowMultiplier: 0.9, motion: 'straight', tier: 'ground' },
  { id: 'train', name: '고속열차', emoji: '🚄', speedKmh: 300, unlockFriends: 30, desc: '정시 출발, 정시 도착.', color: '#962FBF', catchWindowMultiplier: 0.8, motion: 'straight', tier: 'ground' },
  { id: 'plane', name: '비행기', emoji: '✈️', speedKmh: 900, unlockFriends: 40, desc: '하늘길로 하루 안에 지구 반대편.', color: '#1FA1FF', catchWindowMultiplier: 0.8, motion: 'straight', tier: 'air' },
  { id: 'rocket', name: '로켓', emoji: '🚀', speedKmh: 6000, unlockFriends: 55, desc: '불꽃을 남기며 순식간에.', color: '#ED4956', catchWindowMultiplier: 0.7, motion: 'straight', tier: 'space' },
  { id: 'dragon', name: '드래곤', emoji: '🐉', speedKmh: 2500, unlockFriends: 80, premiumItem: 'dragon', desc: '장난 면역. 아무도 떨어뜨릴 수 없어요. (친구 80명 또는 프로)', color: '#2DBE60', catchWindowMultiplier: 1.2, motion: 'drift', immune: true, tier: 'special' },
  { id: 'ufo', name: 'UFO', emoji: '🛸', speedKmh: 12000, unlockFriends: null, premiumItem: 'ufo', desc: '지그재그로 날며 잡기 창이 2배. 모두의 시선.', color: '#00C2A8', catchWindowMultiplier: 2.2, motion: 'zigzag', tier: 'special' },
  { id: 'satellite', name: '궤도 위성', emoji: '🛰️', speedKmh: 28000, unlockFriends: null, premiumItem: 'orbit', desc: '지구를 3바퀴 돌고 착륙. 가장 많은 사람에게 노출.', color: '#FFB800', catchWindowMultiplier: 1.5, motion: 'orbit', tier: 'special' },
];

/** 벌칙 상태 표시용 (실제 수단은 아님) */
export const SNAIL = { emoji: '🐌', name: '달팽이', factor: 0.1, durationMs: 5 * 60_000 } as const;

export const VEHICLE_MAP: Record<VehicleId, Vehicle> = Object.fromEntries(VEHICLES.map((v) => [v.id, v])) as Record<VehicleId, Vehicle>;

export function vehicleUnlocked(v: Vehicle, friendCount: number, inventory: { ufo: number; orbit: number }, plan: 'free' | 'plus' | 'pro') {
  if (v.premiumItem === 'ufo') return inventory.ufo > 0;
  if (v.premiumItem === 'orbit') return inventory.orbit > 0;
  if (v.premiumItem === 'dragon') return plan === 'pro' || friendCount >= (v.unlockFriends ?? Infinity);
  if (v.unlockFriends !== null) {
    const boost = plan === 'pro' ? 10 : plan === 'plus' ? 4 : 0; // 결제 시 요구 친구 수 완화
    return friendCount + boost >= v.unlockFriends;
  }
  return false;
}

export function bestVehicle(friendCount: number, inventory: { ufo: number; orbit: number }, plan: 'free' | 'plus' | 'pro'): VehicleId {
  const ok = VEHICLES.filter((v) => !v.premiumItem && vehicleUnlocked(v, friendCount, inventory, plan));
  return ok[ok.length - 1]?.id ?? 'walk';
}

export function nextUnlock(friendCount: number, plan: 'free' | 'plus' | 'pro'): Vehicle | undefined {
  const boost = plan === 'pro' ? 10 : plan === 'plus' ? 4 : 0;
  return VEHICLES.filter((v) => v.unlockFriends !== null && !v.premiumItem && v.unlockFriends > friendCount + boost).sort((a, b) => (a.unlockFriends ?? 0) - (b.unlockFriends ?? 0))[0];
}
