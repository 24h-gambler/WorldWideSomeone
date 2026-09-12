/**
 * 요금제 · 아이템 · 코인 팩 — 계산 근거는 docs/ECONOMY.md
 * 규칙: 결제 화면(코인 팩·플랜) 밖에서는 원화/달러를 쓰지 않는다. 모든 가격은 썸원코인(SC).
 */
export type PlanId = 'free' | 'plus' | 'pro';

export const COIN = { name: '썸원코인', short: 'SC' } as const;
export const fmtCoins = (n: number) => `${n.toLocaleString('ko-KR')} ${COIN.short}`;

export type Plan = {
  id: PlanId; name: string; priceLabel: string; monthlyKrw: number; productId: string;
  maxWaypoints: number; monthlyShields: number; monthlyUfo: number; monthlyOrbit: number; monthlyDirect: number; monthlyCoins: number;
  unlockBoost: number; dailyLetters: number; dailyPeeks: number; dailyPulls: number; contactBoost: number;
  boostDiscount: number; // 답장 가속·대여 코인 할인율
  badge?: string; perks: string[];
};

export const PLANS: Plan[] = [
  { id: 'free', name: '무료', priceLabel: '₩0', monthlyKrw: 0, productId: '', maxWaypoints: 1, monthlyShields: 0, monthlyUfo: 0, monthlyOrbit: 0, monthlyDirect: 0, monthlyCoins: 0, unlockBoost: 0, dailyLetters: 5, dailyPeeks: 0, dailyPulls: 0, contactBoost: 0, boostDiscount: 0,
    perks: ['걷는 배달원부터 시작 · 친구가 늘면 해금', '경로 변경 경유지 1개', '방어권: 친구 5명마다 1개', '하루 편지 5통'] },
  { id: 'plus', name: '플러스', priceLabel: '₩4,900/월', monthlyKrw: 4900, productId: 'wws_plus_monthly', maxWaypoints: 2, monthlyShields: 5, monthlyUfo: 0, monthlyOrbit: 0, monthlyDirect: 0, monthlyCoins: 300, unlockBoost: 4, dailyLetters: 20, dailyPeeks: 3, dailyPulls: 1, contactBoost: 8, boostDiscount: 0.2, badge: '✦',
    perks: ['매월 300 SC · 가속·대여 20% 할인', '엿보기 하루 3회 · 끌어오기 하루 1회', '경유지 2개 · 매월 방어권 5개', '해금 −4명 · 하루 편지 20통', '컨택 가능성 +8%'] },
  { id: 'pro', name: '프로', priceLabel: '₩12,900/월', monthlyKrw: 12900, productId: 'wws_pro_monthly', maxWaypoints: 3, monthlyShields: 15, monthlyUfo: 3, monthlyOrbit: 1, monthlyDirect: 2, monthlyCoins: 1000, unlockBoost: 10, dailyLetters: Infinity, dailyPeeks: 10, dailyPulls: 3, contactBoost: 15, boostDiscount: 0.5, badge: '★',
    perks: ['매월 1,000 SC · 가속·대여 50% 할인', '엿보기 하루 10회 · 끌어오기 하루 3회', '직행 편지 월 2회', '경유지 3개 · 매월 방어권 15 · UFO 3 · 위성 1', '드래곤 즉시 · 해금 −10명 · 편지 무제한 · ★'] },
];
export const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

/** 코인으로만 사는 아이템 */
export type ItemId = 'shield5' | 'peek5' | 'pull1' | 'direct1' | 'ufo1' | 'orbit1';
export type Item = { id: ItemId; name: string; coins: number; grants: Partial<{ shield: number; peek: number; pull: number; direct: number; ufo: number; orbit: number }>; desc: string };
export const ITEMS: Item[] = [
  { id: 'shield5', name: '방어권 5개', coins: 150, grants: { shield: 5 }, desc: '경로 변경·끌어오기·달팽이·침수·우주 장난을 1회 튕겨내요' },
  { id: 'peek5', name: '엿보기 렌즈 5개', coins: 120, grants: { peek: 5 }, desc: '머리 위를 지나는 편지의 내용을 잡지 않고 미리 봐요' },
  { id: 'pull1', name: '끌어오기 1회', coins: 150, grants: { pull: 1 }, desc: '마음에 든 편지를 내 위치로 오게 해요 (편지당 1회 · 방어권 편지 불가)' },
  { id: 'direct1', name: '직행 편지 1회', coins: 300, grants: { direct: 1 }, desc: '커뮤니티의 그 사람에게 편지가 무조건 도착해요 (통과·장난 없음). 답장은 상대의 마음' },
  { id: 'ufo1', name: 'UFO 티켓', coins: 120, grants: { ufo: 1 }, desc: '초고속 지그재그 · 잡기 창 2배' },
  { id: 'orbit1', name: '궤도 위성', coins: 220, grants: { orbit: 1 }, desc: '지구 3바퀴 · 최대 노출' },
];
export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemId, Item>;

/** 코인 팩 — 원화는 여기(결제 화면)에서만. 많이 살수록 SC 단가가 내려간다. 마진 계산은 ECONOMY.md */
export type PackId = 'sc300' | 'sc800' | 'sc2000' | 'sc5500' | 'sc12000';
export type CoinPack = { id: PackId; storeId: string; coins: number; bonusPct: number; priceKrw: number; priceLabel: string; tag?: string };
export const COIN_PACKS: CoinPack[] = [
  { id: 'sc300', storeId: 'wws_sc_300', coins: 300, bonusPct: 0, priceKrw: 3900, priceLabel: '₩3,900' },
  { id: 'sc800', storeId: 'wws_sc_800', coins: 800, bonusPct: 14, priceKrw: 8900, priceLabel: '₩8,900' },
  { id: 'sc2000', storeId: 'wws_sc_2000', coins: 2000, bonusPct: 30, priceKrw: 19900, priceLabel: '₩19,900', tag: '인기' },
  { id: 'sc5500', storeId: 'wws_sc_5500', coins: 5500, bonusPct: 46, priceKrw: 49000, priceLabel: '₩49,000', tag: '최고 가성비' },
  { id: 'sc12000', storeId: 'wws_sc_12000', coins: 12000, bonusPct: 58, priceKrw: 99000, priceLabel: '₩99,000' },
];
export const PACK_MAP = Object.fromEntries(COIN_PACKS.map((p) => [p.id, p])) as Record<PackId, CoinPack>;

/** 오는 답장을 코인으로 가속 (받는 쪽) */
export const REPLY_BOOST = {
  fast: { coins: 80, factor: 4, label: '4배 빠르게' },
  instant: { coins: 200, seconds: 60, label: '1분 안에 도착' },
} as const;
export type BoostTier = keyof typeof REPLY_BOOST;

/** 잠긴 배달원 1회 대여 — 속도 구간별 코인 */
export function rentalCoins(speedKmh: number): number {
  if (speedKmh < 100) return 40;
  if (speedKmh < 300) return 80;
  if (speedKmh < 1000) return 150;
  if (speedKmh < 3000) return 250;
  return 400;
}
export const discounted = (coins: number, plan: PlanId) => Math.round(coins * (1 - PLAN_MAP[plan].boostDiscount));

export const SHIELD_PER_FRIENDS = 5;
export const COIN_REWARDS = { catch: 10, friend: 25, caughtByOther: 5, received: 3, send: 2, mischief: 1, like: 1, comment: 1 } as const;
export const DAILY_FREE_COIN_CAP = 60; // 플레이로 하루에 얻는 SC 상한 (인플레 방지)
export const OCEAN_RESCUE_COINS = 50;
export const OCEAN_SINK_MS = 3 * 60 * 60_000; // 실서비스 3시간 (로컬 시뮬은 배속 적용)
