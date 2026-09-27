/**
 * 가입 게이트 — 비회원이 보내기·좋아요·댓글·채팅·결제를 누르는 순간에만 뜬다.
 * SNS 가입(애플·구글·카카오). 로컬 모드에서는 즉시 가입 처리(테스트). 실서비스는 Supabase Auth.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ProfileDraft, ProfileForm } from '@/components/profile-form';
import { Button, Row, T } from '@/components/ui';
import { useStore } from '@/store';
import { signInWithProvider } from '@/services/auth';
import { track } from '@/services/analytics';
import { brand, radius, shadow, spacing, useColors } from '@/theme';
import type { AuthProvider } from '@/types';
import Svg, { Path } from 'react-native-svg';

/** 애플 로그인 노출: iOS 는 심사 가이드 4.8 상 필수, 웹도 지원. 안드로이드는 구글·카카오만. */
const APPLE_OK = Platform.OS === 'ios' || Platform.OS === 'web';
const AppleMark = () => (
  <Svg width={16} height={19} viewBox="0 0 16 19"><Path fill={brand.apple.label} d="M13.2 10.1c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C5.1 5.4 3.8 6.2 3.1 7.5c-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6s1.6.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.1zM11.3 3.9c.5-.6.9-1.5.8-2.4-.8 0-1.8.5-2.4 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.5 2.4-1.2z"/></Svg>
);
/** 구글 공식 G 마크(4색) — 브랜드 가이드라인상 임의 아이콘 대체 불가 */
const GoogleMark = () => (
  <Svg width={18} height={18} viewBox="0 0 18 18">
    <Path fill={brand.google.mark.blue} d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <Path fill={brand.google.mark.green} d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <Path fill={brand.google.mark.yellow} d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
    <Path fill={brand.google.mark.red} d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </Svg>
);
/** 카카오 말풍선 */
const KakaoMark = () => (
  <Svg width={18} height={17} viewBox="0 0 18 17"><Path fill={brand.kakao.label} d="M9 .8C4.3.8.5 3.8.5 7.4c0 2.3 1.6 4.4 3.9 5.5-.2.6-.7 2.5-.8 2.9 0 .2.1.4.3.2.2-.1 2.7-1.8 3.4-2.3.6.1 1.1.1 1.7.1 4.7 0 8.5-3 8.5-6.6S13.7.8 9 .8z"/></Svg>
);

/** 로그인 버튼 3종 공통 규격 — 높이 50 · 마크 왼쪽 고정 · 라벨 가운데 */
function ProviderButton({ provider, label, surface, labelColor, border, mark, onPress, busy }: { provider: AuthProvider; label: string; surface: string; labelColor: string; border?: string; mark: React.ReactNode; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      testID={`btn:signup:${provider}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [{ height: 50, borderRadius: radius.sm, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: busy ? 0.6 : pressed ? 0.85 : 1 }, border ? { borderWidth: StyleSheet.hairlineWidth, borderColor: border } : null]}
    >
      <View style={{ position: 'absolute', left: 16 }}>{mark}</View>
      <T style={{ fontWeight: '600', color: labelColor, fontSize: 15 }}>{label}</T>
    </Pressable>
  );
}

type Pending = { reason: string; after?: () => void } | null;
let setPendingRef: ((p: Pending) => void) | null = null;
/** 어디서든 호출: 가입 필요 사유 + 가입 후 이어서 실행할 동작 */
export function openSignup(reason: string, after?: () => void) { track('gate_show', { reason }); setPendingRef?.({ reason, after }); }

const REASONS: Record<string, string> = { send: '편지를 보내려면 계정이 필요해요', like: '좋아요를 남기려면 계정이 필요해요', comment: '댓글을 남기려면 계정이 필요해요', chat: '채팅하려면 계정이 필요해요', pay: '결제하려면 계정이 필요해요', reply: '답장을 보내려면 계정이 필요해요' };

export function SignupHost() {
  const c = useColors();
  const { height } = useWindowDimensions();
  const signUp = useStore((s) => s.signUp);
  const me = useStore((s) => s.me);
  const [pending, setPending] = useState<Pending>(null);
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({ nickname: '', avatar: me.avatar, bio: '', field: me.field, gender: me.gender, job: me.job, hobbies: me.hobbies });
  const [busy, setBusy] = useState(false);
  const y = useRef(new Animated.Value(height)).current;
  useEffect(() => { setPendingRef = setPending; return () => { setPendingRef = null; }; }, []);
  useEffect(() => { Animated.timing(y, { toValue: pending ? 0 : height, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(); if (!pending) setProvider(null); }, [pending, height, y]);
  if (!pending) return null;
  const close = () => { track('gate_dismiss', { reason: pending.reason }); setPending(null); };
  const choose = async (p: AuthProvider) => {
    setBusy(true); track('signup_provider', { provider: p });
    const r = await signInWithProvider(p);
    setBusy(false);
    if (!r.ok) return;
    setDraft((d) => ({ ...d, nickname: d.nickname || r.suggestedName || '' }));
    setProvider(p);
  };
  const finish = () => {
    if (!provider || draft.nickname.trim().length < 2) return;
    signUp(provider, draft);
    const after = pending.after; setPending(null); after?.();
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={close} />
      <Animated.View style={[styles.sheet, shadow.float, { backgroundColor: c.bg, transform: [{ translateY: y }], maxHeight: height * 0.9 }]}>
        <View style={[styles.grip, { backgroundColor: c.line }]} />
        {!provider ? (
          <View style={{ padding: spacing.xl, gap: 12 }}>
            <T t="title">{REASONS[pending.reason] ?? '계정이 필요해요'}</T>
            <T t="body" color={c.text2}>10초면 돼요. 둘러본 건 그대로 남아요.</T>
            <View style={{ gap: 10, marginTop: 8 }}>
              {APPLE_OK && (
                <ProviderButton provider="apple" label="Apple로 계속" surface={brand.apple.surface} labelColor={brand.apple.label} mark={<AppleMark />} onPress={() => choose('apple')} busy={busy} />
              )}
              <ProviderButton provider="google" label="Google로 계속" surface={brand.google.surface} labelColor={brand.google.label} border={brand.google.border} mark={<GoogleMark />} onPress={() => choose('google')} busy={busy} />
              <ProviderButton provider="kakao" label="카카오로 계속" surface={brand.kakao.surface} labelColor={brand.kakao.label} mark={<KakaoMark />} onPress={() => choose('kakao')} busy={busy} />
            </View>
            <Button title="나중에" variant="ghost" onPress={close} track="signup:later" />
            <T t="caption" color={c.text2} style={{ textAlign: 'center' }}>계속하면 이용약관과 개인정보 처리방침에 동의하게 됩니다</T>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: 12 }} keyboardShouldPersistTaps="handled">
              <Row style={{ justifyContent: 'space-between' }}><T t="title">프로필</T><T t="caption" color={c.text2}>커뮤니티에는 ???로 보여요</T></Row>
              <ProfileForm value={draft} onChange={setDraft} />
              <Button title="시작하기" size="lg" full disabled={draft.nickname.trim().length < 2} onPress={finish} track="signup:finish" />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 12 },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
});
