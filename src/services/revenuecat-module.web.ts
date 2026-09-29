/** 웹: 스토어 결제 없음(테스트 결제 Mock 사용) — 네이티브 모듈을 번들에 넣지 않는다 */
export function loadPurchasesModule(): { Purchases: any; PRODUCT_CATEGORY: any } | null {
  return null;
}
