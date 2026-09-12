import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Card, Coin, Header, Row, Screen, Section, T } from '@/components/ui';
import { ItemKey, PRICES, useStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { success, warn } from '@/engine/haptics';

export default function Store() {
  const me = useStore((s) => s.me);
  const buy = useStore((s) => s.buy);
  const buyPremium = useStore((s) => s.buyPremium);
  const [msg, setMsg] = useState<string | null>(null);

  const onBuy = (k: ItemKey) => {
    if (buy(k)) {
      success();
      setMsg(`${PRICES[k].name} 구매 완료!`);
    } else {
      warn();
      setMsg('코인이 부족해요. 편지를 잡거나 친구를 만들면 코인이 쌓여요.');
    }
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <Screen>
      <Header title="상점" subtitle="코인으로 구매 · 실결제는 다음 단계" right={<Coin amount={me.coins} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {msg ? <Card style={{ marginBottom: spacing.md, borderColor: colors.gold }}><T t="small">{msg}</T></Card> : null}

        <LinearGradient colors={['#FFD166', '#FF9A5C', '#FF5C8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: spacing.lg }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T t="h2" color="#1A1030">⭐ 프리미엄</T>
              <T t="small" color="rgba(26,16,48,0.85)">방어권 3 · UFO 1 · 경로 지정 3 · 위성 1 매월 지급 + 스탬프 테마 + 프로필 뱃지</T>
            </View>
          </Row>
          <Row style={{ marginTop: spacing.md, justifyContent: 'space-between' }}>
            <T t="bodyStrong" color="#1A1030">{me.premium ? '구독 중' : '300 코인 (₩5,900/월 예정)'}</T>
            <Button title={me.premium ? '이용 중' : '구독'} size="sm" variant="secondary" disabled={me.premium} onPress={() => { if (buyPremium()) { success(); setMsg('프리미엄 시작! 인벤토리를 확인하세요'); } else { warn(); setMsg('코인이 부족해요'); } setTimeout(() => setMsg(null), 2500); }} />
          </Row>
        </LinearGradient>

        <Section title="아이템">
          {(Object.keys(PRICES) as ItemKey[]).map((k) => {
            const p = PRICES[k];
            return (
              <Card key={k} style={{ marginBottom: spacing.md }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row style={{ flex: 1 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                      <T style={{ fontSize: 28 }}>{p.emoji}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T t="bodyStrong">{p.name} <T t="small" color={colors.textDim}>· 보유 {me.inventory[k]}</T></T>
                      <T t="small" color={colors.textDim}>{p.desc}</T>
                    </View>
                  </Row>
                </Row>
                <Row style={{ marginTop: spacing.md, justifyContent: 'space-between' }}>
                  <T t="bodyStrong" color={colors.gold}>🪙 {p.coins}</T>
                  <Button title="구매" size="sm" variant="gold" onPress={() => onBuy(k)} />
                </Row>
              </Card>
            );
          })}
        </Section>

        <Section title="코인 얻는 법">
          <Card style={{ gap: 6 }}>
            {[
              ['🫳 편지 잡기', '+10'],
              ['🤝 친구 성사', '+20'],
              ['🎉 내 편지가 잡힘', '+5'],
              ['✈️ 편지 보내기', '+2'],
              ['↩️ 장난치기', '+1 (양심상)'],
            ].map(([k, v]) => (
              <Row key={k} style={{ justifyContent: 'space-between' }}>
                <T t="small">{k}</T>
                <T t="small" color={colors.gold}>{v}</T>
              </Row>
            ))}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
