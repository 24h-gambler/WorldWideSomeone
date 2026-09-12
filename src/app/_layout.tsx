import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, GrandHotel_400Regular } from '@expo-google-fonts/grand-hotel';

import { colors } from '@/theme';
import { useStore } from '@/store';
import { Wordmark } from '@/components/ui';
import { getLocationPermission } from '@/services/location';
import { getNotificationPermission, getPushToken, subscribeNotificationTaps } from '@/services/push';
import { startSync, registerPushToken } from '@/services/sync';
import { firebaseEnabled } from '@/services/firebase';
import { purchases } from '@/services/purchases';
import '@/services/background';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const onboarded = useStore((s) => s.onboarded);
  const setPermissions = useStore((s) => s.setPermissions);
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  const [fontsLoaded] = useFonts({ GrandHotel_400Regular });

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  // 1초 게임 틱 (로컬 모드: 봇 세계 / 파이어베이스 모드: 도착·통과 로컬 보조 판정)
  useEffect(() => {
    if (!hydrated) return;
    useStore.getState().tick(Date.now());
    const id = setInterval(() => useStore.getState().tick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hydrated]);

  // 실제 권한 상태 · 푸시 토큰 · 알림 탭 라우팅 · Firebase 동기화 · 결제 초기화
  useEffect(() => {
    if (!hydrated || !onboarded) return;
    (async () => {
      const loc = await getLocationPermission();
      const noti = await getNotificationPermission();
      setPermissions({ location: loc.foreground, backgroundLocation: loc.background, notifications: noti });
      const token = await getPushToken();
      if (token) { setPermissions({ pushToken: token }); registerPushToken(token).catch(() => {}); }
      if (firebaseEnabled) await startSync().catch(() => {});
      await purchases.init(useStore.getState().me.id).catch(() => {});
    })();
    return subscribeNotificationTaps((route) => router.push(route as any));
  }, [hydrated, onboarded, setPermissions, router]);

  useEffect(() => {
    if (hydrated && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated, fontsLoaded]);

  if (!hydrated || !fontsLoaded) {
    return (
      <View style={styles.splash}>
        <Wordmark size={40} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: Platform.OS === 'web' ? 'none' : 'default' }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
          <Stack.Screen name="catch/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="letter/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="store" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="user/[id]" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
