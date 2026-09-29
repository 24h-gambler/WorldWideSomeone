/**
 * 상점 — 원화는 여기(코인 팩·플랜)에서만. 아이템은 전부 썸원코인(SC).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Button, Coin, Header, Icon, Pill, Row, Screen, Section, T, TrackedScrollView } from '@/components/ui';
import { ItemIcon, PRODUCT_ICON } from '@/components/item-art';
import { COIN, COIN_PACKS, ITEMS, fmtCoins, OCEAN_RESCUE_COINS, PLANS, REPLY_BOOST, SHIELD_PER_FRIENDS, type ItemId, type PackId, type PlanId } from '@/data/plans';
import { PAYMENTS_NOT_READY, purchases, type PurchaseResult, type StorePrice } from '@/services/purchases';
import { useGate } from '@/hooks/use-gate';
import { useStore } from '@/store';
import { gradients, radius, spacing, useColors } from '@/theme';
import { success, warn } from '@/engine/haptics';

export default function Store() {
  const router = useRouter();
  const c = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const buyItem = useStore((s) => s.buyItem);
  const gate = useGate();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const flash = (text: string, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg(null), 3500); };
  // 결제 상태: 준비 안 됨(프로덕션 설정 누락) → 버튼 비활성 · 결제 중 → 로딩(다른 결제 버튼도 잠금) · 성공 → 새 잔액 토스트
  const payReady = purchases.ready;
  const [prices, setPrices] = useState<Record<string, StorePrice>>({});
  useEffect(() => { let alive = true; if (payReady) purchases.prices().then((p) => { if (alive) setPrices(p); }).catch(() => {}); return () => { alive = false; }; }, [payReady]);
  const balance = () => fmtCoins(useStore.getState().me.coins);
  const pay = (key: string, run: () => Promise<PurchaseResult>, ok: () => string) => gate('pay', async () => {
    if (!payReady) { warn(); flash(PAYMENTS_NOT_READY, true); return; }
    if (busy) return;
    setBusy(key);
    let r: PurchaseResult;
    try { r = await run(); } catch { r = { ok: false, error: '결제에 실패했어요. 잠시 후 다시 시도해 주세요' }; }
    setBusy(null);
    if (r.ok) { success(); flash(r.message ?? ok()); } else if (!r.cancelled) { warn(); flash(r.error, true); }
  });
  const subscribe = (plan: PlanId) => pay(plan, () => purchases.purchasePlan(plan), () => `${PLANS.find((p) => p.id === plan)!.name} 시작! 이번 달 코인과 아이템이 지급됐어요 · 잔액 ${balance()}`);
  const buyPack = (pack: PackId) => pay(pack, () => purchases.purchasePack(pack), () => `충전 완료 · 잔액 ${balance()}`);
  const restore = () => pay('restore', () => purchases.restore(), () => `구매 복원 완료 · ${PLANS.find((p) => p.id === useStore.getState().me.plan)!.name} · 잔액 ${balance()}`);
  const buy = (id: ItemId) => gate('pay', () => { if (buyItem(id)) { success(); flash(`${ITEMS.find((i) => i.id === id)!.name} 구매 완료`); } else { warn(); flash('코인이 부족해요. 아래에서 충전하세요', true); } });
  const packPrice = (storeId: string, krw: number, label: string) => {
    const sp = prices[storeId];
    return { label: sp?.priceString ?? label, perSc: sp && sp.currencyCode && sp.currencyCode !== 'KRW' ? null : (sp?.price ?? krw) };
  };
  const q = me.quota.date === new Date().toDateString() ? me.quota : { ...me.quota, peeks: 0, pulls: 0 };
  const plan = PLANS.find((p) => p.id === me.plan)!;

  return (
    <Screen>
      <Header title="상점" subtitle={`결제: ${purchases.name === 'revenuecat' ? 'App Store / Google Play' : purchases.name === 'unavailable' ? PAYMENTS_NOT_READY : '테스트 모드'}`} right={<Coin amount={me.coins} />} />
      <TrackedScrollView id="store" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {msg ? <View style={[styles.flash, { backgroundColor: msg.error ? c.redSoft : c.greenSoft }]}><T t="small" color={msg.error ? c.redText : c.greenText}>{msg.text}</T></View> : null}
        {!payReady ? <View style={[styles.flash, { backgroundColor: c.bg3 }]}><T t="smallStrong">{PAYMENTS_NOT_READY}</T><T t="caption" color={c.text2}>코인 팩·플랜 구매가 곧 열려요. 가진 썸원코인으로 아이템은 지금도 살 수 있어요</T></View> : null}
        <View style={[styles.two, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
          <View style={{ flex: 1, gap: 4 }}><T t="bodyStrong" numberOfLines={1}>🤝 친구로</T><T t="small" color={c.text2}>친구 {SHIELD_PER_FRIENDS}명마다 방어권 +1 · 친구 수로 배달원 영구 해금 · 지금 {friendIds.length}명</T></View>
          <View style={{ width: 1, backgroundColor: c.line }} />
          <View style={{ flex: 1, gap: 4 }}><T t="bodyStrong" numberOfLines={1}>🪙 {COIN.name}으로</T><T t="small" color={c.text2}>배달원 1회 대여 · 답장 가속 · 엿보기·끌어오기·직행 편지 · 매월 코인 지급 플랜</T></View>
        </View>

        <View style={[styles.quota, { backgroundColor: c.blueSoft }]}>
          <T t="smallStrong">오늘 남은 한도 · {plan.name}</T>
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            <Pill icon={<ItemIcon id="lens" size={12} />} label={`엿보기 ${Math.max(0, plan.dailyPeeks - q.peeks)}/${plan.dailyPeeks} + 렌즈 ${me.inventory.peek}`} color={c.bg} />
            <Pill icon={<ItemIcon id="magnet" size={12} />} label={`끌어오기 ${Math.max(0, plan.dailyPulls - q.pulls)}/${plan.dailyPulls} + ${me.inventory.pull}`} color={c.bg} />
            <Pill icon={<ItemIcon id="bolt" size={12} />} label={`직행 편지 ${me.inventory.direct}${plan.monthlyDirect ? ` + 월 ${Math.max(0, plan.monthlyDirect - (me.quota.month === new Date().toISOString().slice(0, 7) ? me.quota.direct : 0))}` : ''}`} color={c.bg} />
            <Pill icon={<ItemIcon id="shield" size={12} />} label={`방어권 ${me.inventory.shield}`} color={c.bg} />
          </Row>
          <T t="caption" color={c.text2}>가속·대여 할인 {Math.round(plan.boostDiscount * 100)}% · 답장 가속 {REPLY_BOOST.fast.coins}/{REPLY_BOOST.instant.coins} SC · 침수 구조 {OCEAN_RESCUE_COINS} SC</T>
        </View>

        <Section title="썸원코인 충전" right={<T t="caption" color={c.text2}>많이 살수록 SC 단가가 내려가요</T>}>
          <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
            {COIN_PACKS.map((p) => { const pr = packPrice(p.storeId, p.priceKrw, p.priceLabel); return (
              <View key={p.id} style={[styles.pack, { borderColor: p.tag ? c.blue : c.line, backgroundColor: c.bg }]}>
                <ItemIcon id={p.coins >= 2000 ? 'coins' : 'coin'} size={34} />
                <View style={{ flex: 1 }}>
                  <Row gap={6}><T t="bodyStrong">{p.coins.toLocaleString('ko-KR')} SC</T>{p.bonusPct ? <Pill label={`+${p.bonusPct}%`} color={c.greenSoft} textColor={c.greenText} /> : null}{p.tag ? <Pill label={p.tag} color={c.blueSoft} textColor={c.blueText} /> : null}</Row>
                  {pr.perSc != null ? <T t="caption" color={c.text2}>SC당 ₩{(pr.perSc / p.coins).toFixed(1)}</T> : null}
                </View>
                <Button title={pr.label} size="sm" loading={busy === p.id} disabled={!payReady || (!!busy && busy !== p.id)} onPress={() => buyPack(p.id)} track={`store:pack:${p.id}`} />
              </View>
            ); })}
          </View>
        </Section>

        <Section title="아이템 (SC)">
          {ITEMS.map((it) => (
            <View key={it.id} style={[styles.item, { borderBottomColor: c.lineSoft }]}>
              <View style={[styles.itemIcon, { backgroundColor: c.bg3 }]}><ItemIcon id={PRODUCT_ICON[it.id]} size={34} /></View>
              <View style={{ flex: 1 }}>
                <T t="bodyStrong">{it.name}</T><T t="small" color={c.text2}>{it.desc}</T>
                <Row style={{ marginTop: 6 }}><Button title={`${it.coins} SC`} size="sm" variant={me.coins >= it.coins ? 'primary' : 'secondary'} onPress={() => buy(it.id)} track={`store:item:${it.id}`} /></Row>
              </View>
            </View>
          ))}
          <View style={[styles.item, { borderBottomColor: c.lineSoft }]}><View style={[styles.itemIcon, { backgroundColor: c.bg3 }]}><ItemIcon id="lifebuoy" size={34} /></View><View style={{ flex: 1 }}><T t="bodyStrong">침수 구조</T><T t="small" color={c.text2}>침수된 내 편지를 기다리지 않고 바로 건져요</T></View><Pill label={`편지 상세에서 ${OCEAN_RESCUE_COINS} SC`} /></View>
        </Section>

        <Section title="플랜" right={<T t="caption" color={c.text2}>매월 코인 + 한도 + 할인</T>}>
          <TrackedScrollView id="store-plans" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}>
            {PLANS.map((p) => {
              const current = me.plan === p.id;
              const hi = p.id === 'plus';
              const inner = (
                <View style={{ padding: spacing.lg, gap: 8, minHeight: 320 }}>
                  <Row style={{ justifyContent: 'space-between' }}><T t="h2" color={hi ? '#fff' : c.text}>{p.badge ?? ''} {p.name}</T>{current ? <Pill label="이용 중" color={hi ? 'rgba(255,255,255,0.25)' : c.bg3} textColor={hi ? '#fff' : c.text} /> : null}</Row>
                  <T t="hero" color={hi ? '#fff' : c.text}>{p.productId && prices[p.productId] ? `${prices[p.productId].priceString}/월` : p.priceLabel}</T>
                  {p.monthlyCoins ? <Pill label={`매월 ${p.monthlyCoins.toLocaleString('ko-KR')} SC`} color={hi ? 'rgba(255,255,255,0.25)' : c.blueSoft} textColor={hi ? c.onDark : c.blueText} /> : null}
                  {p.perks.map((k) => <Row key={k} gap={6} style={{ alignItems: 'flex-start' }}><Icon name="check" size={14} color={hi ? '#fff' : c.green} /><T t="small" color={hi ? '#fff' : c.text} style={{ flex: 1 }}>{k}</T></Row>)}
                  <View style={{ flex: 1 }} />
                  {p.id === 'free' ? <Button title="기본" variant="secondary" disabled /> : <Button title={current ? '이용 중' : `${p.name} 시작`} variant={hi ? 'secondary' : 'primary'} loading={busy === p.id} disabled={current || !payReady || (!!busy && busy !== p.id)} onPress={() => subscribe(p.id)} track={`store:plan:${p.id}`} />}
                </View>
              );
              return (
                <View key={p.id} style={[styles.plan, { borderColor: hi ? 'transparent' : c.line, backgroundColor: c.bg }]}>
                  {hi ? <LinearGradient colors={[c.blue, gradients.ig[4]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>{inner}</LinearGradient> : inner}
                </View>
              );
            })}
          </TrackedScrollView>
          <T t="caption" color={c.text2} style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>월 구독 · 자동 갱신 · 언제든 스토어 구독 관리에서 해지</T>
        </Section>

        <Section title="코인 얻는 법 (하루 60 SC까지)">
          <View style={{ paddingHorizontal: spacing.lg, gap: 4 }}>
            <T t="small" color={c.text2}>편지 잡기 +10 · 친구 +25 · 내 편지가 잡힘 +5 · 답장 받음 +3 · 발송 +2 · 장난 +1 · 좋아요/댓글 +1</T>
          </View>
        </Section>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}><Button title="구매 복원" variant="ghost" size="sm" loading={busy === 'restore'} disabled={!payReady || (!!busy && busy !== 'restore')} onPress={restore} track="store:restore" /></View>
      </TrackedScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flash: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: 10, borderRadius: radius.sm },
  two: { flexDirection: 'row', gap: 12, margin: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  quota: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, gap: 8 },
  pack: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  itemIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  plan: { width: 250, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
});
