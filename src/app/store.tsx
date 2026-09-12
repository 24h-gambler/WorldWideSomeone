import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Button, Coin, Header, Icon, Pill, Row, Screen, Section, T } from '@/components/ui';
import { OCEAN_RESCUE_COINS, PLANS, PRODUCTS, SHIELD_PER_FRIENDS, type PlanId, type ProductId } from '@/data/plans';
import { purchases } from '@/services/purchases';
import { ItemIcon, PRODUCT_ICON } from '@/components/item-art';
import { useStore } from '@/store';
import { radius, spacing, useColors } from '@/theme';
import { success, warn } from '@/engine/haptics';

export default function Store() {
  const router = useRouter();
  const c = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const buyWithCoins = useStore((s) => s.buyWithCoins);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };
  const subscribe = async (plan: PlanId) => { setBusy(plan); const r = await purchases.purchasePlan(plan); setBusy(null); if (r.ok) { success(); flash(`${PLANS.find((p) => p.id === plan)!.name} 시작! 이번 달 아이템이 지급됐어요`); } else if (!r.cancelled) { warn(); flash(r.error); } };
  const buy = async (id: ProductId) => { setBusy(id); const r = await purchases.purchaseProduct(id); setBusy(null); if (r.ok) { success(); flash('구매 완료'); } else if (!r.cancelled) { warn(); flash(r.error); } };
  const q = me.quota.date === new Date().toDateString() ? me.quota : { peeks: 0, pulls: 0 };
  const plan = PLANS.find((p) => p.id === me.plan)!;

  return (
    <Screen>
      <Header title="상점" subtitle={`결제: ${purchases.name === 'revenuecat' ? 'App Store / Google Play' : '테스트 모드 (Expo Go)'}`} right={<Coin amount={me.coins} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {msg ? <View style={[styles.flash, { backgroundColor: c.greenSoft }]}><Icon name="check-circle" size={16} color={c.green} /><T t="small">{msg}</T></View> : null}
        <View style={[styles.paths, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
          <View style={{ flex: 1, gap: 4 }}><T t="bodyStrong">🤝 친구를 많이 만들거나</T><T t="small" color={c.text2}>친구 {SHIELD_PER_FRIENDS}명마다 방어권 +1 · 친구 수로 배달원 해금 · 지금 {friendIds.length}명</T></View>
          <View style={{ width: 1, backgroundColor: c.line }} />
          <View style={{ flex: 1, gap: 4 }}><T t="bodyStrong">💳 결제하거나</T><T t="small" color={c.text2}>엿보기·끌어오기·즉시 친구 · 매월 방어권 · 경유지 2~3개 · 해금 완화</T></View>
        </View>
        <View style={[styles.quota, { backgroundColor: c.blueSoft }]}>
          <T t="smallStrong">오늘 남은 한도 · {plan.name}</T>
          <Row style={{ flexWrap: 'wrap' }} gap={6}><Pill icon={<ItemIcon id="lens" size={12} />} label={`엿보기 ${Math.max(0, plan.dailyPeeks - q.peeks)}/${plan.dailyPeeks} + 렌즈 ${me.inventory.peek}`} color={c.bg} /><Pill icon={<ItemIcon id="magnet" size={12} />} label={`끌어오기 ${Math.max(0, plan.dailyPulls - q.pulls)}/${plan.dailyPulls} + ${me.inventory.pull}`} color={c.bg} /><Pill icon={<ItemIcon id="bolt" size={12} />} label={`즉시 친구 ${me.inventory.instant}`} color={c.bg} /><Pill icon={<ItemIcon id="shield" size={12} />} label={`방어권 ${me.inventory.shield}`} color={c.bg} /></Row>
          <T t="caption" color={c.text2}>한도 계산 근거: docs/ECONOMY.md — 끌어오기는 편지당 1회, 전체 편지의 15% 이하만 끌리도록 설계</T>
        </View>

        <Section title="플랜">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}>
            {PLANS.map((p) => { const current = me.plan === p.id; const dark = p.id !== 'free'; const card = (
              <View style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}><T t="h2" color={dark ? '#fff' : c.text}>{p.badge ?? ''} {p.name}</T>{current ? <Pill label="이용 중" color={dark ? 'rgba(255,255,255,0.25)' : c.bg3} textColor={dark ? '#fff' : c.text} /> : null}</Row>
                <T t="title" color={dark ? '#fff' : c.text}>{p.priceLabel}</T>
                {p.perks.map((x) => <Row key={x} gap={6}><Icon name="check" size={14} color={dark ? '#fff' : c.green} /><T t="small" color={dark ? 'rgba(255,255,255,0.92)' : c.text2} style={{ flex: 1 }}>{x}</T></Row>)}
                <View style={{ height: 6 }} />
                {p.id === 'free' ? <Button title="기본" variant="secondary" disabled /> : <Button title={current ? '이용 중' : `${p.name} 시작`} variant={p.id === 'pro' ? 'dark' : 'primary'} disabled={current} loading={busy === p.id} onPress={() => subscribe(p.id)} />}
              </View>
            ); return p.id === 'free' ? <View key={p.id} style={[styles.plan, { backgroundColor: c.bg, borderWidth: 1, borderColor: c.line }]}>{card}</View> : <LinearGradient key={p.id} colors={p.id === 'pro' ? ['#833AB4', '#E1306C', '#F77737'] : ['#0095F6', '#5851DB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plan}>{card}</LinearGradient>; })}
          </ScrollView>
          <T t="caption" color={c.text3} style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>월 구독 · 언제든 해지 · 스토어 결제는 dev build에서 RevenueCat으로 처리돼요</T>
        </Section>

        <Section title="아이템">
          {PRODUCTS.map((p) => (
            <View key={p.id} style={[styles.item, { borderBottomColor: c.lineSoft }]}>
              <View style={[styles.itemIcon, { backgroundColor: c.bg3 }]}><ItemIcon id={PRODUCT_ICON[p.id]} size={34} /></View>
              <View style={{ flex: 1 }}>
                <T t="bodyStrong">{p.name}</T><T t="small" color={c.text2}>{p.desc}</T>
                <Row style={{ marginTop: 6 }}><Button title={p.priceLabel} size="sm" loading={busy === p.id} onPress={() => buy(p.id)} />{p.coins ? <Button title={`🪙 ${p.coins}`} size="sm" variant="secondary" onPress={() => (buyWithCoins(p.id) ? (success(), flash(`${p.name} 코인 구매 완료`)) : (warn(), flash('코인이 부족해요. 편지를 잡거나 친구를 만들면 쌓여요.')))} /> : null}</Row>
              </View>
            </View>
          ))}
          <View style={[styles.item, { borderBottomColor: c.lineSoft }]}><View style={[styles.itemIcon, { backgroundColor: c.bg3 }]}><ItemIcon id="lifebuoy" size={34} /></View><View style={{ flex: 1 }}><T t="bodyStrong">바다 구조</T><T t="small" color={c.text2}>바다에 빠진 내 편지를 기다리지 않고 바로 건져요 · 편지 화면에서 🪙 {OCEAN_RESCUE_COINS}</T></View></View>
        </Section>

        <Section title="코인 얻는 법"><View style={{ paddingHorizontal: spacing.lg, gap: 4 }}>{[['🫳 편지 잡기', '+10'], ['🤝 친구 성사(왕복 확정)', '+25'], ['🎉 내 편지가 잡힘', '+5'], ['❤️ 엽서 좋아요 · 💬 댓글', '+1'], ['✈️ 편지 보내기', '+2'], ['😈 장난치기', '+1']].map(([k, v]) => <Row key={k} style={{ justifyContent: 'space-between' }}><T t="small">{k}</T><T t="smallStrong">{v}</T></Row>)}</View></Section>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}><Button title="구매 복원" variant="ghost" size="sm" onPress={async () => { const r = await purchases.restore(); flash(r.ok ? '복원 완료' : r.error); }} /><Row style={{ justifyContent: 'center', marginTop: 8 }} gap={12}><T t="caption" color={c.text3} onPress={() => router.push('/settings')}>이용약관</T><T t="caption" color={c.text3}>개인정보 처리방침</T></Row></View>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  flash: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: 10, borderRadius: radius.sm },
  paths: { flexDirection: 'row', gap: 12, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  quota: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, gap: 6 },
  plan: { width: 250, borderRadius: radius.lg, padding: spacing.lg },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  itemIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
