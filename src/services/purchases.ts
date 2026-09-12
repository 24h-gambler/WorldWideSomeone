/**
 * 결제 어댑터 — 원화 결제는 오직 코인 팩과 플랜뿐. 아이템은 전부 썸원코인(SC)으로 산다.
 * 실제 스토어 결제는 RevenueCat(react-native-purchases) — dev build에서만 동작. Expo Go / 웹에서는 Mock(테스트 결제).
 * 서버 지급(이중 검증)은 supabase/functions/purchase-webhook.
 */
import { Alert, Platform } from 'react-native';
import { COIN_PACKS, PLANS, type PackId, type PlanId } from '@/data/plans';
import { useStore } from '@/store';
import { track } from '@/services/analytics';

export type PurchaseResult = { ok: true } | { ok: false; error: string; cancelled?: boolean };

export interface PurchaseProvider {
  readonly name: 'mock' | 'revenuecat';
  init(userId: string): Promise<void>;
  purchasePlan(plan: PlanId): Promise<PurchaseResult>;
  purchasePack(pack: PackId): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

function confirm(title: string, body: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${body}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '결제 (테스트)', onPress: () => resolve(true) },
    ]);
  });
}

const mock: PurchaseProvider = {
  name: 'mock',
  async init() {},
  async purchasePlan(plan) {
    const P = PLANS.find((p) => p.id === plan)!;
    track('purchase_start', { plan });
    const ok = await confirm(`${P.name} ${P.priceLabel}`, '테스트 결제입니다. 실제 청구되지 않아요. (스토어 결제는 dev build + RevenueCat)');
    if (!ok) { track('purchase_cancel', { plan }); return { ok: false, error: 'cancelled', cancelled: true }; }
    useStore.getState().setPlan(plan, Date.now() + 30 * 86_400_000);
    return { ok: true };
  },
  async purchasePack(pack) {
    const p = COIN_PACKS.find((x) => x.id === pack)!;
    track('purchase_start', { pack });
    const ok = await confirm(`${p.coins.toLocaleString('ko-KR')} SC ${p.priceLabel}`, '테스트 결제입니다. 실제 청구되지 않아요.');
    if (!ok) { track('purchase_cancel', { pack }); return { ok: false, error: 'cancelled', cancelled: true }; }
    useStore.getState().applyPack(pack);
    return { ok: true };
  },
  async restore() { return { ok: true }; },
};

/** RevenueCat 어댑터: 모듈이 설치되어 있을 때만 활성 */
function loadRevenueCat(): PurchaseProvider | null {
  if (Platform.OS === 'web') return null;
  let Purchases: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Purchases = require('react-native-purchases').default;
  } catch { return null; }
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
  if (!key) return null;
  const applyEntitlements = (info: any) => {
    const ent = info?.entitlements?.active ?? {};
    const plan: PlanId = ent.pro ? 'pro' : ent.plus ? 'plus' : 'free';
    const exp = (ent.pro ?? ent.plus)?.expirationDate ? Date.parse((ent.pro ?? ent.plus).expirationDate) : undefined;
    if (plan !== useStore.getState().me.plan) useStore.getState().setPlan(plan, exp);
  };
  return {
    name: 'revenuecat',
    async init(userId) {
      Purchases.configure({ apiKey: key, appUserID: userId });
      Purchases.addCustomerInfoUpdateListener(applyEntitlements);
      applyEntitlements(await Purchases.getCustomerInfo());
    },
    async purchasePlan(plan) {
      try {
        track('purchase_start', { plan });
        const offerings = await Purchases.getOfferings();
        const pkg = offerings.current?.availablePackages.find((p: any) => p.product.identifier === PLANS.find((x) => x.id === plan)!.productId);
        if (!pkg) return { ok: false, error: '상품을 찾을 수 없어요' };
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        applyEntitlements(customerInfo);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? 'purchase failed', cancelled: !!e?.userCancelled };
      }
    },
    async purchasePack(pack) {
      try {
        track('purchase_start', { pack });
        const p = COIN_PACKS.find((x) => x.id === pack)!;
        const products = await Purchases.getProducts([p.storeId]);
        if (!products[0]) return { ok: false, error: '상품을 찾을 수 없어요' };
        await Purchases.purchaseStoreProduct(products[0]);
        useStore.getState().applyPack(pack); // 서버 웹훅(purchase-webhook)에서 이중 검증 후 확정 지급
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? 'purchase failed', cancelled: !!e?.userCancelled };
      }
    },
    async restore() {
      try { applyEntitlements(await Purchases.restorePurchases()); return { ok: true }; } catch (e: any) { return { ok: false, error: e?.message ?? 'restore failed' }; }
    },
  };
}

export const purchases: PurchaseProvider = loadRevenueCat() ?? mock;
