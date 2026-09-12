import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Globe } from '@/components/globe/Globe';
import { ProfileDraft, ProfileForm } from '@/components/profile-form';
import { LocationPicker } from '@/components/location-picker';
import { Button, Header, Icon, Row, Screen, T, Wordmark, type FeatherName } from '@/components/ui';
import { requestNotificationPermission } from '@/services/push';
import { useStore } from '@/store';
import type { Place } from '@/types';
import { radius, spacing, useColors } from '@/theme';
import { success } from '@/engine/haptics';

const STEPS = ['welcome', 'profile', 'location'] as const;
const FEATURES: { icon: FeatherName; title: string; body: string }[] = [
  { icon: 'send', title: '편지를 날려요', body: '걷는 배달원부터 시작. 친구가 늘면 새, 자전거, 스포츠카, 비행기, 로켓으로 빨라져요.' },
  { icon: 'bell', title: '머리 위를 지나면 알림', body: '잡거나, 경로를 바꾸거나, 바다에 빠뜨리거나. 방어권으로 내 편지를 지켜요.' },
  { icon: 'message-circle', title: '편지가 한 번 왕복하면 친구', body: '답장을 받고 프로필을 본 뒤 수락 → 상대가 확정. 그때부터 지연 없는 채팅.' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState<(typeof STEPS)[number]>('welcome');
  const [draft, setDraft] = useState<ProfileDraft>({ nickname: '', avatar: '🦊', bio: '', field: 'IT/개발', gender: 'private', job: '학생', hobbies: [] });
  const [place, setPlace] = useState<Place | null>(null);

  if (step === 'welcome') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
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
                <View style={{ flex: 1 }}>
                  <T t="bodyStrong">{f.title}</T>
                  <T t="small" color={colors.text2}>{f.body}</T>
                </View>
              </Row>
            ))}
          </View>
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
            <Button title="시작하기" size="lg" full onPress={() => setStep('profile')} />
            <T t="caption" color={colors.text3} style={{ textAlign: 'center', marginTop: spacing.md }}>계속하면 이용약관과 개인정보 처리방침에 동의하게 됩니다</T>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (step === 'profile') {
    const ok = draft.nickname.trim().length >= 2;
    return (
      <Screen>
        <Header title="프로필 만들기" subtitle="1/2 · 커뮤니티에는 ???로, 태그만 공개돼요" onBack={() => setStep('welcome')} right={<Button title="다음" size="sm" variant="ghost" disabled={!ok} onPress={() => setStep('location')} />} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <ProfileForm value={draft} onChange={setDraft} />
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line }]}><Button title="다음" size="lg" full disabled={!ok} onPress={() => setStep('location')} /></View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="어디에서 날릴까요?" subtitle="2/2 · 친구에게는 50km 반경으로만 보여요" onBack={() => setStep('profile')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <LocationPicker value={place} onChange={setPlace} compact />
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
        <Button
          title="지구로 들어가기"
          size="lg"
          full
          disabled={!place}
          onPress={async () => {
            if (!place) return;
            success();
            complete({ ...draft, location: place });
            requestNotificationPermission().catch(() => {});
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 16, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.xl },
  featureIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
});
