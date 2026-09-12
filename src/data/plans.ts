/**
 * 요금제 · 상품. "결제를 많이 하거나 친구를 많이 만들거나"로 성장하는 게임의 경제 설계.
 * 실제 결제는 RevenueCat(App Store / Google Play) — src/services/purchases.ts
 */
export type PlanId = 'free' | 'plus' | 'pro';

export type Plan = {
  id: PlanId;
  name: string;
  priceLabel: string;
  monthlyKrw: number;
  productId: string; // RevenueCat / 스토어 상품 ID
  maxWaypoints: number; // 지나가는 편지 경로 변경 시 경유지 수
  monthlyShields: number;
  monthlyUfo: number;
  monthlyOrbit: number;
  unlockBoost: number; // 운송수단 해금 요구 친구 수 완화
  dailyLetters: number; // 하루 발송 한도 (Infinity = 무제한)
  contactBoost: number; // 컨택 가능성 가산
  badge?: string;
  perks: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'free', name: '무료', priceLabel: '₩0', monthlyKrw: 0, productId: '', maxWaypoints: 1, monthlyShields: 0, monthlyUfo: 0, monthlyOrbit: 0, unlockBoost: 0, dailyLetters: 5, contactBoost: 0,
    perks: ['걷는 배달원부터 시작', '지나가는 편지 경로 변경 경유지 1개', '방어권: 친구 5명마다 1개', '하루 편지 5통'],
  },
  {
    id: 'plus', name: '플러스', priceLabel: '₩4,900/월', monthlyKrw: 4900, productId: 'wws_plus_monthly', maxWaypoints: 2, monthlyShields: 5, monthlyUfo: 0, monthlyOrbit: 0, unlockBoost: 4, dailyLetters: 20, contactBoost: 8, badge: '✦',
    perks: ['경유지 2개', '매월 방어권 5개', '운송수단 해금 −4명', '하루 편지 20통', '컨택 가능성 +8%', '스탬프 테마'],
  },
  {
    id: 'pro', name: '프로', priceLabel: '₩9,900/월', monthlyKrw: 9900, productId: 'wws_pro_monthly', maxWaypoints: 3, monthlyShields: 15, monthlyUfo: 3, monthlyOrbit: 1, unlockBoost: 10, dailyLetters: Infinity, contactBoost: 15, badge: '★',
    perks: ['경유지 3개', '매월 방어권 15개 · UFO 3 · 위성 1', '드래곤(장난 면역) 즉시', '운송수단 해금 −10명', '편지 무제한', '컨택 가능성 +15%', '프로필 ★ 뱃지 · 우선 노출'],
  },
];
export const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

export type ProductId = 'shield5' | 'ufo1' | 'orbit1' | 'coins300' | 'coins1000';
export type Product = { id: ProductId; storeId: string; name: string; emoji: string; priceKrw: number; priceLabel: string; coins?: number; grants: Partial<{ shield: number; ufo: number; orbit: number; coins: number }>; desc: string };

export const PRODUCTS: Product[] = [
  { id: 'shield5', storeId: 'wws_shield_5', name: '방어권 5개', emoji: '🛡️', priceKrw: 2900, priceLabel: '₩2,900', coins: 150, grants: { shield: 5 }, desc: '내 편지를 장난(경로 변경·반환·바다·우주·달팽이)에서 1회 지켜요' },
  { id: 'ufo1', storeId: 'wws_ufo_1', name: 'UFO 티켓', emoji: '🛸', priceKrw: 1900, priceLabel: '₩1,900', coins: 120, grants: { ufo: 1 }, desc: '초고속 지그재그, 잡기 창 2배' },
  { id: 'orbit1', storeId: 'wws_orbit_1', name: '궤도 위성', emoji: '🛰️', priceKrw: 3900, priceLabel: '₩3,900', coins: 220, grants: { orbit: 1 }, desc: '지구 3바퀴 순회 · 최대 노출' },
  { id: 'coins300', storeId: 'wws_coins_300', name: '코인 300', emoji: '🪙', priceKrw: 3900, priceLabel: '₩3,900', grants: { coins: 300 }, desc: '아이템 구매용 코인' },
  { id: 'coins1000', storeId: 'wws_coins_1000', name: '코인 1,000', emoji: '💰', priceKrw: 9900, priceLabel: '₩9,900', grants: { coins: 1000 }, desc: '20% 보너스' },
];

export const SHIELD_PER_FRIENDS = 5;
export const COIN_REWARDS = { catch: 10, friend: 25, caughtByOther: 5, send: 2, mischief: 1, like: 1 } as const;
