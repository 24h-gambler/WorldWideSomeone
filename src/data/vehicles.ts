import type { VehicleId } from '@/types';

export type Vehicle = {
  id: VehicleId;
  name: string;
  emoji: string;
  speedKmh: number; // 시뮬 속도
  unlockFriends: number | null; // null = 유료 전용
  premiumItem?: 'ufo' | 'orbit';
  desc: string;
  color: string;
  catchWindowMultiplier: number; // 잡기 창 길이 배수
  motion: 'straight' | 'drift' | 'zigzag' | 'orbit';
  immune?: boolean; // 장난 면역
  trail: 'dots' | 'line' | 'glow' | 'sparkle';
};

export const VEHICLES: Vehicle[] = [
  {
    id: 'paper',
    name: '종이비행기',
    emoji: '✈️',
    speedKmh: 300,
    unlockFriends: 0,
    desc: '처음 접은 종이비행기. 바람을 타고 천천히 날아가요.',
    color: '#F4F6FF',
    catchWindowMultiplier: 1,
    motion: 'drift',
    trail: 'dots',
  },
  {
    id: 'pigeon',
    name: '전서구',
    emoji: '🕊️',
    speedKmh: 600,
    unlockFriends: 2,
    desc: '충직한 비둘기. 종이비행기의 두 배 속도.',
    color: '#DDE3FF',
    catchWindowMultiplier: 1,
    motion: 'straight',
    trail: 'dots',
  },
  {
    id: 'balloon',
    name: '열기구',
    emoji: '🎈',
    speedKmh: 450,
    unlockFriends: 5,
    desc: '느리지만 넓게 표류해요. 더 많은 사람 머리 위를 지나갑니다.',
    color: '#FF5C8A',
    catchWindowMultiplier: 1.6,
    motion: 'drift',
    trail: 'dots',
  },
  {
    id: 'prop',
    name: '프로펠러기',
    emoji: '🛩️',
    speedKmh: 900,
    unlockFriends: 10,
    desc: '클래식한 소형 비행기. 안정적인 여행.',
    color: '#5AB8FF',
    catchWindowMultiplier: 1,
    motion: 'straight',
    trail: 'line',
  },
  {
    id: 'jet',
    name: '제트기',
    emoji: '✈️',
    speedKmh: 1800,
    unlockFriends: 20,
    desc: '대륙을 순식간에. 잡기 창은 짧지만 도착이 빨라요.',
    color: '#7C5CFF',
    catchWindowMultiplier: 0.8,
    motion: 'straight',
    trail: 'line',
  },
  {
    id: 'rocket',
    name: '로켓',
    emoji: '🚀',
    speedKmh: 6000,
    unlockFriends: 35,
    desc: '하늘 높이, 불꽃 흔적을 남기며.',
    color: '#FFA94D',
    catchWindowMultiplier: 0.7,
    motion: 'straight',
    trail: 'glow',
  },
  {
    id: 'dragon',
    name: '드래곤',
    emoji: '🐉',
    speedKmh: 2500,
    unlockFriends: 60,
    desc: '장난에 면역! 아무도 이 편지를 떨어뜨릴 수 없어요.',
    color: '#3DDC97',
    catchWindowMultiplier: 1.2,
    motion: 'drift',
    immune: true,
    trail: 'glow',
  },
  {
    id: 'ufo',
    name: 'UFO',
    emoji: '🛸',
    speedKmh: 12000,
    unlockFriends: null,
    premiumItem: 'ufo',
    desc: '지그재그로 날며 반짝여요. 잡기 창이 길고 모두가 쳐다봅니다.',
    color: '#4FE3C1',
    catchWindowMultiplier: 2.2,
    motion: 'zigzag',
    trail: 'sparkle',
  },
  {
    id: 'satellite',
    name: '궤도 위성',
    emoji: '🛰️',
    speedKmh: 28000,
    unlockFriends: null,
    premiumItem: 'orbit',
    desc: '지구를 3바퀴 돌고 착륙. 가장 많은 사람에게 노출돼요.',
    color: '#FFD166',
    catchWindowMultiplier: 1.5,
    motion: 'orbit',
    trail: 'glow',
  },
];

export const VEHICLE_MAP: Record<VehicleId, Vehicle> = Object.fromEntries(
  VEHICLES.map((v) => [v.id, v]),
) as Record<VehicleId, Vehicle>;

export function vehicleUnlocked(v: Vehicle, friendCount: number, inventory: { ufo: number; orbit: number }) {
  if (v.unlockFriends !== null) return friendCount >= v.unlockFriends;
  if (v.premiumItem === 'ufo') return inventory.ufo > 0;
  if (v.premiumItem === 'orbit') return inventory.orbit > 0;
  return false;
}

export function nextUnlock(friendCount: number): Vehicle | undefined {
  return VEHICLES.filter((v) => v.unlockFriends !== null && v.unlockFriends > friendCount).sort(
    (a, b) => (a.unlockFriends ?? 0) - (b.unlockFriends ?? 0),
  )[0];
}
