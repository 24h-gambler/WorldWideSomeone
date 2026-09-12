import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Button, Coin, Header, Icon, Pill, Row, Screen, Section, T } from '@/components/ui';
import { PLANS, PRODUCTS, SHIELD_PER_FRIENDS, type PlanId, type ProductId } from '@/data/plans';
import { purchases } from '@/services/purchases';
import { useStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { success, warn } from '@/engine/haptics';

export default function Store() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const buyWithCoins = useStore((s) => s.buyWithCoins);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const subscribe = async (plan: PlanId) => {
    setBusy(plan);
    const r = await purchases.purchasePlan(plan);
    setBusy(null);
    if (r.ok) { success(); flash(`${PLANS.find((p) => p.id === plan)!.name} 시작! 이번 달 아이템이 지급됐어요`); }
    else if (!r.cancelled) { warn(); flash(r.error); }
  };
  const buy = async (id: ProductId) => {
    setBusy(id);
    const r = await purchases.purchaseProduct(id);
    setBusy(null);
    if (r.ok) { success(); flash('구매 완료'); } else if (!r.cancelled) { warn(); flash(r.error); }
  };

  return (
    <Screen>
      <Header title="상점" subtitle={`결제: ${purchases.name === 'revenuecat' ? 'App Store / Google Play' : '테스트 모드 (Expo Go)'}`} right={<Coin amount={me.coins} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {msg ? <View style={styles.flash}><Icon name="check-circle" size={16} color={colors.green} /><T t="small">{msg}</T></View> : null}

        {/* 성장 두 갈래 */}
        <View style={styles.paths}>
          <View style={{ flex: 1, gap: 4 }}>
            <T t="bodyStrong">🤝 친구를 많이 만들거나</T>
            <T t="small" color={colors.text2}>친구 {SHIELD_PER_FRIENDS}명마다 방어권 +1 · 친구 수로 배달원 해금 · 지금 {friendIds.length}명</T>
          </View>
          <View style={{ width: 1, backgroundColor: colors.line }} />
          <View style={{ flex: 1, gap: 4 }}>
            <T t="bodyStrong">💳 결제하거나</T>
            <T t="small" color={colors.text2}>매월 방어권·UFO·위성 지급 · 경유지 2~3개 · 해금 요구 친구 수 완화</T>
          </View>
        </View>

        <Section title="플랜">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}>
            {PLANS.map((p) => {
              const current = me.plan === p.id;
              const card = (
                <View style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T t="h2" color={p.id === 'free' ? colors.text : '#fff'}>{p.badge ?? ''} {p.name}</T>
                    {current ? <Pill label="이용 중" color={p.id === 'free' ? colors.bg3 : 'rgba(255,255,255,0.25)'} textColor={p.id === 'free' ? colors.text : '#fff'} /> : null}
                  </Row>
                  <T t="title" color={p.id === 'free' ? colors.text : '#fff'}>{p.priceLabel}</T>
                  {p.perks.map((x) => <Row key={x} gap={6}><Icon name="check" size={14} color={p.id === 'free' ? colors.green : '#fff'} /><T t="small" color={p.id === 'free' ? colors.text2 : 'rgba(255,255,255,0.92)'} style={{ flex: 1 }}>{x}</T></Row>)}
                  <View style={{ height: 6 }} />
                  {p.id === 'free' ? <Button title="기본" variant="secondary" disabled /> : <Button title={current ? '이용 중' : `${p.name} 시작`} variant={p.id === 'pro' ? 'dark' : 'primary'} disabled={current} loading={busy === p.id} onPress={() => subscribe(p.id)} />}
                </View>
              );
              return p.id === 'free' ? (
                <View key={p.id} style={[styles.plan, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }]}>{card}</View>
              ) : (
                <LinearGradient key={p.id} colors={p.id === 'pro' ? ['#833AB4', '#E1306C', '#F77737'] : ['#0095F6', '#5851DB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plan}>{card}</LinearGradient>
              );
            })}
          </ScrollView>
          <T t="caption" color={colors.text3} style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>월 구독 · 언제든 해지 · 스토어 결제는 dev build에서 RevenueCat으로 처리돼요 (docs/LAUNCH.md)</T>
        </Section>

        <Section title="아이템">
          {PRODUCTS.map((p) => (
            <View key={p.id} style={styles.item}>
              <View style={styles.itemIcon}><T style={{ fontSize: 26 }}>{p.emoji}</T></View>
              <View style={{ flex: 1 }}>
                <T t="bodyStrong">{p.name}</T>
                <T t="small" color={colors.text2}>{p.desc}</T>
                <Row style={{ marginTop: 6 }}>
                  <Button title={p.priceLabel} size="sm" loading={busy === p.id} onPress={() => buy(p.id)} />
                  {p.coins ? <Button title={`🪙 ${p.coins}`} size="sm" variant="secondary" onPress={() => (buyWithCoins(p.id) ? (success(), flash(`${p.name} 코인 구매 완료`)) : (warn(), flash('코인이 부족해요. 편지를 잡거나 친구를 만들면 쌓여요.')))} /> : null}
                </Row>
              </View>
            </View>
          ))}
        </Section>

        <Section title="코인 얻는 법">
          <View style={{ paddingHorizontal: spacing.lg, gap: 4 }}>
            {[['🫳 편지 잡기', '+10'], ['🤝 친구 성사(승인)', '+25'], ['🎉 내 편지가 잡힘', '+5'], ['❤️ 엽서 좋아요', '+1'], ['✈️ 편지 보내기', '+2'], ['😈 장난치기', '+1']].map(([k, v]) => <Row key={k} style={{ justifyContent: 'space-between' }}><T t="small">{k}</T><T t="smallStrong">{v}</T></Row>)}
          </View>
        </Section>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Button title="구매 복원" variant="ghost" size="sm" onPress={async () => { const r = await purchases.restore(); flash(r.ok ? '복원 완료' : r.error); }} />
          <Row style={{ justifyContent: 'center', marginTop: 8 }} gap={12}><T t="caption" color={colors.text3} onPress={() => router.push('/settings')}>이용약관</T><T t="caption" color={colors.text3}>개인정보 처리방침</T></Row>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flash: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.greenSoft, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: 10, borderRadius: radius.sm },
  paths: { flexDirection: 'row', gap: 12, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.lineSoft },
  plan: { width: 250, borderRadius: radius.lg, padding: spacing.lg },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  itemIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
});
