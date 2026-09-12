/**
 * 첫 진입 — 환영 한 화면 → 위치만 잡고 바로 비회원으로 지구에 들어간다. 가입은 보내기/좋아요 때만.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Globe } from '@/components/globe/Globe';
import { LocationPicker } from '@/components/location-picker';
import { Button, Header, Icon, Row, Screen, T, TrackedScrollView, Wordmark, type FeatherName } from '@/components/ui';
import { requestNotificationPermission } from '@/services/push';
import { getCurrentPlace } from '@/services/location';
import { useStore } from '@/store';
import type { Place } from '@/types';
import { radius, spacing, useColors } from '@/theme';
import { success } from '@/engine/haptics';
import { track } from '@/services/analytics';

const FEATURES: { icon: FeatherName; title: string; body: string }[] = [
  { icon: 'send', title: '편지를 날려요', body: '걷는 배달원부터. 친구가 늘면 새, 자전거, 스포츠카, 비행기, 로켓.' },
  { icon: 'bell', title: '머리 위를 지나면 알림', body: '잡거나, 엿보거나, 경로를 바꾸거나. 방어권으로 내 편지를 지켜요.' },
  { icon: 'message-circle', title: '편지가 왕복하면 친구', body: '내 편지에 답장이 오고, 수락하면 그때부터 실시간 채팅.' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const enter = useStore((s) => s.enterAsGuest);
  const [step, setStep] = useState<'welcome' | 'location'>('welcome');
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => { track('onboarding_view', { step }); }, [step]);

  const go = async () => {
    // GPS 가 이미 허용돼 있으면 묻지 않고 바로 들어간다
    setLocating(true);
    const p = await getCurrentPlace(false).catch(() => null);
    setLocating(false);
    if (p) { success(); enter(p); requestNotificationPermission().catch(() => {}); }
    else setStep('location');
  };

  if (step === 'welcome') {
    return (
      <Screen>
        <TrackedScrollView id="onboarding" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[...colors.sky] as any} style={styles.hero}>
            <Globe size={Math.min(width - 32, 300)} letters={[]} me={null} autoRotate fps={24} interactive={false} />
          </LinearGradient>
          <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center', marginTop: spacing.xl }}>
            <Wordmark size={44} />
            <T t="body" color={colors.text2} style={{ textAlign: 'center', marginTop: 4 }}>전 세계 누군가에게 편지를 날리고, 잡고, 친구가 되는 곳</T>
          </View>
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.lg }}>
            {FEATURES.map((f) => (
              <Row key={f.title} gap={14} style={{ alignItems: 'flex-start' }}>
                <View style={[styles.featureIcon, { backgroundColor: colors.blueSoft }]}><Icon name={f.icon} size={20} color={colors.blue} /></View>
                <View style={{ flex: 1 }}><T t="bodyStrong">{f.title}</T><T t="small" color={colors.text2}>{f.body}</T></View>
              </Row>
            ))}
          </View>
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
            <Button title="둘러보기" size="lg" full loading={locating} onPress={go} track="onboarding:start" />
            <T t="caption" color={colors.text3} style={{ textAlign: 'center', marginTop: spacing.md }}>가입 없이 바로 시작해요</T>
          </View>
        </TrackedScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="어디에서 볼까요?" subtitle="머리 위를 지나는 편지를 찾으려면 위치가 필요해요" onBack={() => setStep('welcome')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <LocationPicker value={place} onChange={setPlace} compact />
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
        <Button title="지구로 들어가기" size="lg" full disabled={!place} track="onboarding:enter" onPress={() => { if (!place) return; success(); enter(place); requestNotificationPermission().catch(() => {}); }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 16, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.xl },
  featureIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
});
