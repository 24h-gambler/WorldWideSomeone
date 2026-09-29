/**
 * 결제 어댑터 — 원화 결제는 오직 코인 팩과 플랜뿐. 아이템은 전부 썸원코인(SC)으로 산다.
 *
 * - iOS·Android: RevenueCat(react-native-purchases). appUserID = Supabase auth uid(가입 필수).
 *   결제 성공 · 복원 · 앱 시작(로그인 상태) 때 서버 함수 `rc-grant` 를 불러 지급을 확정하고, 그 결과(코인·플랜)만 앱에 반영한다.
 *   로컬에서 코인을 더하지 않는다 — 서버가 정답. (중복 지급 방지: 스토어 트랜잭션 id, purchase-webhook 과 같은 키)
 * - 프로덕션 네이티브에서 모듈·키·Supabase 중 하나라도 없으면 테스트 결제로 떨어지지 않고 "결제 준비 중" 상태(구매 버튼 비활성).
 * - Mock(테스트 결제)은 웹과 개발 빌드(__DEV__)에서만.
 */
import { Alert, Platform } from 'react-native';
import { COIN_PACKS, PLANS, type PackId, type PlanId } from '@/data/plans';
import { useStore } from '@/store';
import { track } from '@/services/analytics';
import { supabase, supabaseEnabled } from '@/services/supabase';
import { loadPurchasesModule } from '@/services/revenuecat-module';

export const PAYMENTS_NOT_READY = '결제 준비 중이에요';

export type PurchaseResult = { ok: true; message?: string } | { ok: false; error: string; cancelled?: boolean };
export type StorePrice = { priceString: string; price?: number; currencyCode?: string };
export type ProviderName = 'mock' | 'revenuecat' | 'unavailable';

export interface PurchaseProvider {
  readonly name: ProviderName;
  /** false 면 결제 버튼을 비활성화하고 notReadyReason 을 보여준다 */
  readonly ready: boolean;
  readonly notReadyReason?: string;
  /** 앱 시작·로그인 직후: (로그인 상태면) 스토어 계정 연결 + 서버 지급 확정 */
  init(): Promise<void>;
  /** 스토어 가격 문자열 (storeId → 가격). 못 가져오면 빈 객체 → plans.ts 의 priceLabel 을 쓴다 */
  prices(): Promise<Record<string, StorePrice>>;
  purchasePlan(plan: PlanId): Promise<PurchaseResult>;
  purchasePack(pack: PackId): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

/** RevenueCat 공개 SDK 키 (앱에 들어가라고 만든 키). 비밀 키 sk_ 는 서버 rc-grant 에만 */
const RC_PUBLIC = { ios: '', android: 'goog_ZNCHPVvlDHVdCpsOFHxOncjssaX' };

const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2 };
const baseId = (id: string) => id.split(':')[0]; // Google 구독: "productId:basePlanId"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────── Mock (웹 · 개발 빌드 전용) ─────────────────────────
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
  ready: true,
  async init() {},
  async prices() { return {}; },
  async purchasePlan(plan) {
    const P = PLANS.find((p) => p.id === plan)!;
    track('purchase_start', { plan });
    const ok = await confirm(`${P.name} ${P.priceLabel}`, '테스트 결제입니다. 실제 청구되지 않아요.');
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

// ───────────────────────── 결제 준비 중 (프로덕션에서 설정 누락) ─────────────────────────
function unavailable(reason: string): PurchaseProvider {
  const no = async (): Promise<PurchaseResult> => ({ ok: false, error: PAYMENTS_NOT_READY });
  return { name: 'unavailable', ready: false, notReadyReason: reason, async init() {}, async prices() { return {}; }, purchasePlan: no, purchasePack: no, restore: no };
}

// ───────────────────────── 서버 지급 확정 (rc-grant) ─────────────────────────
type Wallet = { coins: number; plan: PlanId; planExpiresAt: number | null; inventory?: Record<string, number>; granted?: { productId: string; txn: string; coins: number }[]; pending?: number };

let grantInflight: Promise<Wallet> | null = null;
/** rc-grant 호출 → 서버가 확정한 지갑을 앱에 반영 (동시 호출은 하나로 합친다) */
function serverGrant(): Promise<Wallet> {
  if (grantInflight) return grantInflight;
  grantInflight = (async () => {
    if (!supabase) throw new Error(PAYMENTS_NOT_READY);
    const { data, error } = await supabase.functions.invoke('rc-grant', { body: {} });
    if (error) throw error;
    const w = data as Wallet;
    if (typeof w?.coins !== 'number' || !w.plan) throw new Error('bad rc-grant response');
    useStore.getState().applyServerWallet({ coins: w.coins, plan: w.plan, planExpiresAt: w.planExpiresAt, inventory: w.inventory as any });
    return w;
  })().finally(() => { grantInflight = null; });
  return grantInflight;
}

/** 결제 직후: 서버 반영이 보일 때까지 짧게 재시도 (스토어 → RevenueCat 반영 지연 대비) */
async function grantUntil(done: (w: Wallet) => boolean): Promise<Wallet | null> {
  let last: Wallet | null = null;
  for (const wait of [0, 1500, 3000, 5000]) {
    if (wait) await sleep(wait);
    try { last = await serverGrant(); if (done(last)) return last; } catch { /* 다음 시도 */ }
  }
  return last;
}

async function sessionUid(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function rcError(e: any, fallback: string): PurchaseResult {
  if (e?.userCancelled) return { ok: false, error: 'cancelled', cancelled: true };
  const code = String(e?.code ?? '');
  if (code === '20') return { ok: false, error: '결제 승인 대기 중이에요. 승인되면 자동으로 반영돼요' };
  if (code === '3') return { ok: false, error: '이 기기에서는 결제가 허용되지 않아요' };
  if (code === '6') return { ok: false, error: '이미 구매한 상품이에요. 구매 복원을 눌러 주세요' };
  if (code === '10') return { ok: false, error: '네트워크 연결을 확인해 주세요' };
  return { ok: false, error: fallback };
}

// ───────────────────────── RevenueCat (iOS · Android) ─────────────────────────
function loadRevenueCat(): PurchaseProvider | string {
  const mod = loadPurchasesModule();
  if (!mod) return 'react-native-purchases 모듈 없음';
  const key = Platform.OS === 'ios' ? (process.env.EXPO_PUBLIC_RC_IOS_KEY || RC_PUBLIC.ios) : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || RC_PUBLIC.android);
  if (!key) return `EXPO_PUBLIC_RC_${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}_KEY 없음`;
  if (!supabaseEnabled) return 'Supabase 설정 없음 (서버 지급 불가)';
  const { Purchases, PRODUCT_CATEGORY } = mod;

  let configured = false;
  let loggedInAs: string | null = null;
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let purchasing = false; // 결제 흐름이 직접 rc-grant 를 부르는 동안 리스너 동기화는 쉰다
  // 엔타이틀먼트 변경(갱신·만료·다른 기기 구매) → 서버에 다시 확인. 플랜 표시는 서버 결과가 이긴다
  const onCustomerInfo = () => {
    if (!loggedInAs || purchasing) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { serverGrant().catch(() => {}); }, 800);
  };
  const ensureConfigured = async (uid?: string | null) => {
    if (!configured) {
      Purchases.configure(uid ? { apiKey: key, appUserID: uid } : { apiKey: key });
      Purchases.addCustomerInfoUpdateListener(onCustomerInfo);
      configured = true;
      loggedInAs = uid ?? null;
      return;
    }
    if (uid && loggedInAs !== uid) { await Purchases.logIn(uid); loggedInAs = uid; }
  };
  /** 결제 전 필수: 로그인된 Supabase 계정으로 스토어 계정을 연결 */
  const requireUser = async (): Promise<string | null> => {
    const uid = await sessionUid();
    if (!uid) return null;
    await ensureConfigured(uid);
    return uid;
  };

  const findPlanPackage = async (productId: string) => {
    const offerings = await Purchases.getOfferings();
    const pools = [offerings?.current, ...Object.values(offerings?.all ?? {})].filter(Boolean) as any[];
    for (const o of pools) {
      const pkg = (o.availablePackages ?? []).find((p: any) => baseId(p.product?.identifier ?? '') === productId);
      if (pkg) return { pkg, product: null };
    }
    const [product] = await Purchases.getProducts([productId], PRODUCT_CATEGORY.SUBSCRIPTION);
    return product ? { pkg: null, product } : null;
  };

  const buyPlan = async (plan: PlanId): Promise<PurchaseResult> => {
    const P = PLANS.find((x) => x.id === plan)!;
    try {
      if (!(await requireUser())) return { ok: false, error: '로그인이 필요해요. 다시 로그인해 주세요' };
      track('purchase_start', { plan });
      const found = await findPlanPackage(P.productId);
      if (!found) return { ok: false, error: '상품을 찾을 수 없어요. 잠시 후 다시 시도해 주세요' };
      // Android: 플러스 ↔ 프로 전환은 기존 구독을 교체해야 이중 구독이 안 생긴다
      const cur = useStore.getState().me.plan;
      const change = Platform.OS === 'android' && cur !== 'free' && cur !== plan ? { oldProductIdentifier: PLANS.find((x) => x.id === cur)!.productId } : null;
      if (found.pkg) await Purchases.purchasePackage(found.pkg, null, change);
      else await Purchases.purchaseStoreProduct(found.product, change);
    } catch (e: any) {
      const r = rcError(e, '결제에 실패했어요. 잠시 후 다시 시도해 주세요');
      if (!r.ok && r.cancelled) track('purchase_cancel', { plan });
      return r;
    }
    const w = await grantUntil((x) => PLAN_RANK[x.plan] >= PLAN_RANK[plan]);
    track('purchase', { plan, krw: P.monthlyKrw, verified: !!w && PLAN_RANK[w.plan] >= PLAN_RANK[plan] });
    if (!w || PLAN_RANK[w.plan] < PLAN_RANK[plan]) return { ok: true, message: '결제는 완료됐어요. 플랜 반영까지 잠시 걸릴 수 있어요' };
    return { ok: true };
  };
  const buyPack = async (pack: PackId): Promise<PurchaseResult> => {
    const p = COIN_PACKS.find((x) => x.id === pack)!;
    try {
      if (!(await requireUser())) return { ok: false, error: '로그인이 필요해요. 다시 로그인해 주세요' };
      track('purchase_start', { pack });
      const [product] = await Purchases.getProducts([p.storeId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      if (!product) return { ok: false, error: '상품을 찾을 수 없어요. 잠시 후 다시 시도해 주세요' };
      await Purchases.purchaseStoreProduct(product);
    } catch (e: any) {
      const r = rcError(e, '결제에 실패했어요. 잠시 후 다시 시도해 주세요');
      if (!r.ok && r.cancelled) track('purchase_cancel', { pack });
      return r;
    }
    // 코인은 서버(rc-grant)만 지급한다 — 로컬 가산 없음
    const w = await grantUntil((x) => (x.granted ?? []).some((g) => g.productId === p.storeId));
    const verified = !!w && (w.granted ?? []).some((g) => g.productId === p.storeId);
    track('purchase', { pack, krw: p.priceKrw, coins: p.coins, verified });
    if (!w) return { ok: true, message: '결제는 완료됐어요. 코인은 잠시 후 반영돼요' };
    return { ok: true };
  };
  return {
    name: 'revenuecat',
    ready: true,
    async init() {
      const uid = await sessionUid();
      await ensureConfigured(uid);
      if (uid) await serverGrant().catch(() => {});
    },
    async prices() {
      const out: Record<string, StorePrice> = {};
      try {
        await ensureConfigured(await sessionUid());
        const put = (p: any) => { if (p?.identifier) out[baseId(p.identifier)] = { priceString: p.priceString, price: p.price, currencyCode: p.currencyCode }; };
        (await Purchases.getProducts(COIN_PACKS.map((p) => p.storeId), PRODUCT_CATEGORY.NON_SUBSCRIPTION)).forEach(put);
        (await Purchases.getProducts(PLANS.filter((p) => p.productId).map((p) => p.productId), PRODUCT_CATEGORY.SUBSCRIPTION)).forEach(put);
      } catch { /* 가격은 plans.ts 표기로 대체 */ }
      return out;
    },
    async purchasePlan(plan) { purchasing = true; try { return await buyPlan(plan); } finally { purchasing = false; } },
    async purchasePack(pack) { purchasing = true; try { return await buyPack(pack); } finally { purchasing = false; } },
    async restore() {
      try {
        if (!(await requireUser())) return { ok: false, error: '로그인이 필요해요. 다시 로그인해 주세요' };
        await Purchases.restorePurchases();
        await serverGrant();
        return { ok: true };
      } catch (e: any) {
        return rcError(e, '복원에 실패했어요. 잠시 후 다시 시도해 주세요');
      }
    },
  };
}

function pickProvider(): PurchaseProvider {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return mock; // 웹: 테스트 결제
  const rc = loadRevenueCat();
  if (typeof rc !== 'string') return rc;
  if (__DEV__) return mock; // 개발 빌드(Expo Go 등)만 테스트 결제 허용
  return unavailable(rc);   // 프로덕션: 절대 Mock 으로 떨어지지 않는다
}

export const purchases: PurchaseProvider = pickProvider();
