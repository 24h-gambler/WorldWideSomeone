/**
 * 결제 어댑터. 실제 스토어 결제는 RevenueCat(react-native-purchases) — dev build에서만 동작.
 * Expo Go / 웹에서는 Mock 어댑터가 확인 다이얼로그 후 즉시 지급(테스트용).
 *
 * 연동 절차(docs/LAUNCH.md):
 *  1) npx expo install react-native-purchases
 *  2) App Store Connect / Google Play Console 에 PLANS·PRODUCTS의 storeId 로 상품 생성
 *  3) RevenueCat 프로젝트에서 Entitlement 'plus','pro' 와 Offering 구성
 *  4) EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY 설정
 */
import { Alert, Platform } from 'react-native';
import { PLANS, PRODUCTS, type PlanId, type ProductId } from '@/data/plans';
import { useStore } from '@/store';

export type PurchaseResult = { ok: true } | { ok: false; error: string; cancelled?: boolean };

export interface PurchaseProvider {
  readonly name: 'mock' | 'revenuecat';
  init(userId: string): Promise<void>;
  purchasePlan(plan: PlanId): Promise<PurchaseResult>;
  purchaseProduct(product: ProductId): Promise<PurchaseResult>;
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
    const ok = await confirm(`${P.name} ${P.priceLabel}`, '테스트 결제입니다. 실제 청구되지 않아요. (스토어 결제는 dev build + RevenueCat)');
    if (!ok) return { ok: false, error: 'cancelled', cancelled: true };
    useStore.getState().setPlan(plan, Date.now() + 30 * 86_400_000);
    return { ok: true };
  },
  async purchaseProduct(product) {
    const p = PRODUCTS.find((x) => x.id === product)!;
    const ok = await confirm(`${p.name} ${p.priceLabel}`, '테스트 결제입니다. 실제 청구되지 않아요.');
    if (!ok) return { ok: false, error: 'cancelled', cancelled: true };
    useStore.getState().applyPurchase(product);
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
    async purchaseProduct(product) {
      try {
        const p = PRODUCTS.find((x) => x.id === product)!;
        const products = await Purchases.getProducts([p.storeId]);
        if (!products[0]) return { ok: false, error: '상품을 찾을 수 없어요' };
        await Purchases.purchaseStoreProduct(products[0]);
        useStore.getState().applyPurchase(product); // 소모품은 서버 웹훅(functions: revenuecatWebhook)에서도 이중 검증
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
