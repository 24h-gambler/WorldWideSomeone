import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Globe } from '@/components/globe/Globe';
import { ProfileDraft, ProfileForm } from '@/components/profile-form';
import { LocationPicker } from '@/components/location-picker';
import { Button, Screen, T } from '@/components/ui';
import { requestNotificationPermission } from '@/engine/notify';
import { useStore } from '@/store';
import type { Place } from '@/types';
import { colors, spacing } from '@/theme';
import { success } from '@/engine/haptics';

const STEPS = ['welcome', 'profile', 'location'] as const;

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState<(typeof STEPS)[number]>('welcome');
  const [draft, setDraft] = useState<ProfileDraft>({ nickname: '', avatar: '🦊', bio: '', field: 'IT/개발', gender: 'private', job: '학생', hobbies: [] });
  const [place, setPlace] = useState<Place | null>(null);

  if (step === 'welcome') {
    const size = Math.min(width * 1.1, height * 0.55);
    return (
      <Screen padded={false} style={{ alignItems: 'center' }}>
        <View style={{ marginTop: -size * 0.12, opacity: 0.95 }}>
          <Globe size={size} letters={[]} me={null} autoRotate fps={24} dim />
        </View>
        <View style={styles.welcomeBody}>
          <T t="caption" color={colors.accent} style={{ letterSpacing: 2 }}>WORLDWIDESOMEONE</T>
          <T t="hero" style={{ textAlign: 'center' }}>전 세계 누군가에게{'\n'}편지를 날려요</T>
          <T t="body" color={colors.textDim} style={{ textAlign: 'center' }}>
            종이비행기에 마음을 접어 하늘로. 누군가의 머리 위를 지나면 알림이 가고, 잡은 사람과 친구가 돼요.
          </T>
          <View style={styles.pillRow}>
            {['✈️ 날리기', '🔔 머리 위 알림', '🫳 잡기', '🤝 친구'].map((x) => (
              <View key={x} style={styles.pill}><T t="small">{x}</T></View>
            ))}
          </View>
          <Button title="시작하기" size="lg" full onPress={() => setStep('profile')} />
        </View>
      </Screen>
    );
  }

  if (step === 'profile') {
    const ok = draft.nickname.trim().length >= 2;
    return (
      <Screen>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
            <StepDots index={1} />
            <T t="title" style={{ marginTop: spacing.lg }}>당신은 어떤 사람인가요?</T>
            <T t="body" color={colors.textDim} style={{ marginBottom: spacing.xl }}>커뮤니티에는 <T t="bodyStrong">???</T>로 표시되고, 태그만 공개돼요. 친구가 되면 닉네임이 보여요.</T>
            <ProfileForm value={draft} onChange={setDraft} />
          </ScrollView>
          <View style={styles.footer}>
            <Button title="다음" size="lg" full disabled={!ok} onPress={() => setStep('location')} />
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <StepDots index={2} />
        <T t="title" style={{ marginTop: spacing.lg }}>어디에서 날릴 건가요?</T>
        <T t="body" color={colors.textDim} style={{ marginBottom: spacing.lg }}>편지는 여기서 출발하고, 이 하늘 위를 지나는 편지를 잡을 수 있어요. 친구에게는 50km 반경으로만 공유돼요.</T>
        <LocationPicker value={place} onChange={setPlace} compact />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title="지구로 들어가기 🌍"
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

function StepDots({ index }: { index: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= index ? colors.accent : colors.card }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeBody: { flex: 1, width: '100%', paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.lg, justifyContent: 'flex-end', paddingBottom: spacing.xxl },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.bg },
});

export const _unused = LinearGradient;
