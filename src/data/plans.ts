/** 요금제 · 상품 · 한도 — 계산 근거는 docs/ECONOMY.md */
export type PlanId = 'free' | 'plus' | 'pro';

export type Plan = {
  id: PlanId; name: string; priceLabel: string; monthlyKrw: number; productId: string;
  maxWaypoints: number; monthlyShields: number; monthlyUfo: number; monthlyOrbit: number; monthlyInstant: number;
  unlockBoost: number; dailyLetters: number; dailyPeeks: number; dailyPulls: number; contactBoost: number;
  acceptDelivery: 'normal' | 'fastest' | 'instant';
  badge?: string; perks: string[];
};

export const PLANS: Plan[] = [
  { id: 'free', name: '무료', priceLabel: '₩0', monthlyKrw: 0, productId: '', maxWaypoints: 1, monthlyShields: 0, monthlyUfo: 0, monthlyOrbit: 0, monthlyInstant: 0, unlockBoost: 0, dailyLetters: 5, dailyPeeks: 0, dailyPulls: 0, contactBoost: 0, acceptDelivery: 'normal',
    perks: ['걷는 배달원부터 시작', '경로 변경 경유지 1개', '방어권: 친구 5명마다 1개', '하루 편지 5통'] },
  { id: 'plus', name: '플러스', priceLabel: '₩4,900/월', monthlyKrw: 4900, productId: 'wws_plus_monthly', maxWaypoints: 2, monthlyShields: 5, monthlyUfo: 0, monthlyOrbit: 0, monthlyInstant: 0, unlockBoost: 4, dailyLetters: 20, dailyPeeks: 3, dailyPulls: 1, contactBoost: 8, acceptDelivery: 'fastest', badge: '✦',
    perks: ['엿보기 하루 3회 · 끌어오기 하루 1회', '경유지 2개 · 매월 방어권 5개', '해금 −4명 · 하루 편지 20통', '수락 편지는 가장 빠른 배달원', '컨택 가능성 +8%'] },
  { id: 'pro', name: '프로', priceLabel: '₩12,900/월', monthlyKrw: 12900, productId: 'wws_pro_monthly', maxWaypoints: 3, monthlyShields: 15, monthlyUfo: 3, monthlyOrbit: 1, monthlyInstant: 2, unlockBoost: 10, dailyLetters: Infinity, dailyPeeks: 10, dailyPulls: 3, contactBoost: 15, acceptDelivery: 'instant', badge: '★',
    perks: ['엿보기 하루 10회 · 끌어오기 하루 3회', '즉시 친구 월 2회', '경유지 3개 · 매월 방어권 15 · UFO 3 · 위성 1', '드래곤 즉시 · 해금 −10명 · 편지 무제한', '수락 편지 즉시 전달 · 우선 노출 · ★'] },
];
export const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

export type ProductId = 'shield5' | 'peek5' | 'pull1' | 'instant1' | 'ufo1' | 'orbit1' | 'coins300' | 'coins1000';
export type Product = { id: ProductId; storeId: string; name: string; emoji: string; priceKrw: number; priceLabel: string; coins?: number; grants: Partial<{ shield: number; peek: number; pull: number; instant: number; ufo: number; orbit: number; coins: number }>; desc: string };

export const PRODUCTS: Product[] = [
  { id: 'shield5', storeId: 'wws_shield_5', name: '방어권 5개', emoji: '🛡️', priceKrw: 2900, priceLabel: '₩2,900', coins: 150, grants: { shield: 5 }, desc: '경로 변경·끌어오기·달팽이·반환·바다·우주에서 1회 지켜요' },
  { id: 'peek5', storeId: 'wws_peek_5', name: '엿보기 렌즈 5개', emoji: '🔍', priceKrw: 1900, priceLabel: '₩1,900', coins: 120, grants: { peek: 5 }, desc: '머리 위를 지나는 편지의 내용을 잡지 않고 미리 봐요' },
  { id: 'pull1', storeId: 'wws_pull_1', name: '끌어오기 1회', emoji: '🧲', priceKrw: 1900, priceLabel: '₩1,900', coins: 150, grants: { pull: 1 }, desc: '마음에 든 편지를 내 위치로 오게 해요 (편지당 1회 · 방어권 편지 불가)' },
  { id: 'instant1', storeId: 'wws_instant_1', name: '즉시 친구 1회', emoji: '⚡', priceKrw: 3900, priceLabel: '₩3,900', coins: 300, grants: { instant: 1 }, desc: '커뮤니티에서 왕복 없이 친구 요청 · 상대가 거절하면 환불' },
  { id: 'ufo1', storeId: 'wws_ufo_1', name: 'UFO 티켓', emoji: '🛸', priceKrw: 1900, priceLabel: '₩1,900', coins: 120, grants: { ufo: 1 }, desc: '초고속 지그재그 · 잡기 창 2배' },
  { id: 'orbit1', storeId: 'wws_orbit_1', name: '궤도 위성', emoji: '🛰️', priceKrw: 3900, priceLabel: '₩3,900', coins: 220, grants: { orbit: 1 }, desc: '지구 3바퀴 · 최대 노출' },
  { id: 'coins300', storeId: 'wws_coins_300', name: '코인 300', emoji: '🪙', priceKrw: 3900, priceLabel: '₩3,900', grants: { coins: 300 }, desc: '아이템 구매용 코인' },
  { id: 'coins1000', storeId: 'wws_coins_1000', name: '코인 1,000', emoji: '💰', priceKrw: 9900, priceLabel: '₩9,900', grants: { coins: 1000 }, desc: '20% 보너스' },
];

export const SHIELD_PER_FRIENDS = 5;
export const COIN_REWARDS = { catch: 10, friend: 25, caughtByOther: 5, send: 2, mischief: 1, like: 1, comment: 1 } as const;
export const OCEAN_RESCUE_COINS = 50;
export const OCEAN_SINK_MS = 3 * 60 * 60_000; // 실서비스 3시간 (로컬 시뮬은 배속 적용)
