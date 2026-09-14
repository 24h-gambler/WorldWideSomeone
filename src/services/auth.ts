/**
 * SNS 로그인 — Supabase Auth(google · apple · kakao). 로컬 모드(환경변수 없음)에서는 즉시 성공(테스트).
 * 실기기: expo-web-browser 로 OAuth 창을 열고 딥링크(wws://auth)로 세션을 받는다 (docs/LAUNCH.md §Auth).
 */
import { Platform } from 'react-native';
import { supabase, supabaseEnabled } from './supabase';
import type { AuthProvider } from '@/types';

export type SignInResult = { ok: true; userId?: string; email?: string; suggestedName?: string } | { ok: false; error: string };

/** iOS 는 애플 네이티브 시트(심사 가이드 4.8) → identity token 을 Supabase 로 교환. 실패하면 웹 OAuth 로 넘어간다. */
async function signInWithAppleNative(): Promise<SignInResult | null> {
  if (Platform.OS !== 'ios' || !supabase) return null;
  try {
    const AppleAuthentication = require('expo-apple-authentication');
    if (!(await AppleAuthentication.isAvailableAsync())) return null;
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
    if (!cred.identityToken) return { ok: false, error: 'no token' };
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) return { ok: false, error: error.message };
    const given = cred.fullName?.givenName ?? '';
    return { ok: true, userId: data.user?.id, email: data.user?.email ?? cred.email ?? undefined, suggestedName: given.slice(0, 12) };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { ok: false, error: 'cancelled' };
    return null; // 네이티브 불가 → 웹 OAuth 로 폴백
  }
}

export async function signInWithProvider(provider: AuthProvider): Promise<SignInResult> {
  if (provider === 'guest') return { ok: true };
  if (!supabaseEnabled || !supabase) return { ok: true, suggestedName: '' }; // 로컬 테스트: 즉시 성공
  try {
    if (provider === 'apple') { const r = await signInWithAppleNative(); if (r) return r; }
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    const WebBrowser = require('expo-web-browser');
    const Linking = require('expo-linking');
    const redirectTo = Linking.createURL('auth');
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) return { ok: false, error: error?.message ?? 'no url' };
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success') return { ok: false, error: 'cancelled' };
    const params = new URL(res.url.replace('#', '?')).searchParams;
    const access_token = params.get('access_token'); const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return { ok: false, error: 'no token' };
    const { data: sess, error: e2 } = await supabase.auth.setSession({ access_token, refresh_token });
    if (e2) return { ok: false, error: e2.message };
    const u = sess.user;
    return { ok: true, userId: u?.id, email: u?.email ?? undefined, suggestedName: (u?.user_metadata?.name as string | undefined)?.slice(0, 12) };
  } catch (e: any) { return { ok: false, error: e?.message ?? 'auth failed' }; }
}
export async function signOut() { if (supabase) await supabase.auth.signOut(); }
