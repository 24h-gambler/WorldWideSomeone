/**
 * react-native-purchases 네이티브 모듈 로더 (iOS·Android). 웹은 revenuecat-module.web.ts 가 null 을 돌려준다.
 * 모듈이 없거나(Expo Go 등) 로드에 실패하면 null.
 */
export function loadPurchasesModule(): { Purchases: any; PRODUCT_CATEGORY: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    const Purchases = mod?.default ?? mod;
    if (!Purchases?.configure) return null;
    return { Purchases, PRODUCT_CATEGORY: mod?.PRODUCT_CATEGORY ?? Purchases?.PRODUCT_CATEGORY ?? { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION', SUBSCRIPTION: 'SUBSCRIPTION' } };
  } catch {
    return null;
  }
}
