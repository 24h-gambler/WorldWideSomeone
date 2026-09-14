/**
 * 가입 게이트 — 비회원이 보내기·좋아요·댓글·채팅·결제를 누르는 순간에만 뜬다.
 * SNS 가입(애플·구글·카카오). 로컬 모드에서는 즉시 가입 처리(테스트). 실서비스는 Supabase Auth.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ProfileDraft, ProfileForm } from '@/components/profile-form';
import { Button, Icon, Row, T } from '@/components/ui';
import { useStore } from '@/store';
import { signInWithProvider } from '@/services/auth';
import { track } from '@/services/analytics';
import { radius, shadow, spacing, useColors } from '@/theme';
import type { AuthProvider } from '@/types';
import Svg, { Path } from 'react-native-svg';

/** 애플 로그인 노출: iOS 는 심사 가이드 4.8 상 필수, 웹도 지원. 안드로이드는 구글·카카오만. */
const APPLE_OK = Platform.OS === 'ios' || Platform.OS === 'web';
const AppleMark = () => (
  <Svg width={16} height={19} viewBox="0 0 16 19"><Path fill="#FFFFFF" d="M13.2 10.1c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C5.1 5.4 3.8 6.2 3.1 7.5c-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6s1.6.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.1zM11.3 3.9c.5-.6.9-1.5.8-2.4-.8 0-1.8.5-2.4 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.8-.5 2.4-1.2z"/></Svg>
);

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
                <Pressable onPress={() => choose('apple')} testID="btn:signup:apple" style={({ pressed }) => [{ height: 50, borderRadius: radius.sm, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 }]}>
                  <AppleMark /><T style={{ fontWeight: '600', color: '#FFFFFF', fontSize: 15 }}>Apple로 계속</T>
                </Pressable>
              )}
              <Button title="Google로 계속" icon="chrome" variant="secondary" size="lg" full loading={busy} onPress={() => choose('google')} track="signup:google" />
              <Pressable onPress={() => choose('kakao')} testID="btn:signup:kakao" style={({ pressed }) => [{ height: 50, borderRadius: radius.sm, backgroundColor: '#FEE500', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 }]}>
                <Icon name="message-circle" size={18} color="#191919" /><T style={{ fontWeight: '600', color: '#191919', fontSize: 15 }}>카카오로 계속</T>
              </Pressable>
            </View>
            <Button title="나중에" variant="ghost" onPress={close} track="signup:later" />
            <T t="caption" color={c.text3} style={{ textAlign: 'center' }}>계속하면 이용약관과 개인정보 처리방침에 동의하게 됩니다</T>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: 12 }} keyboardShouldPersistTaps="handled">
              <Row style={{ justifyContent: 'space-between' }}><T t="title">프로필</T><T t="caption" color={c.text3}>커뮤니티에는 ???로 보여요</T></Row>
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
