import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { LocationPicker } from '@/components/location-picker';
import { Button, Chip, Header, Icon, ListRow, Pill, Row, Screen, Section, T } from '@/components/ui';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { getLocationPermission, requestBackgroundLocation, requestForegroundLocation, startBackgroundLocation, stopBackgroundLocation } from '@/services/location';
import { getNotificationPermission, getPushToken, requestNotificationPermission } from '@/services/push';
import { pushProfile, registerPushToken, stopSync } from '@/services/sync';
import { signOut } from '@/services/auth';
import { openSignup } from '@/components/signup-sheet';
import { supabaseEnabled } from '@/services/supabase';
import { purchases } from '@/services/purchases';
import type { PermissionState } from '@/types';

const permLabel = (colors: ReturnType<typeof useColors>): Record<PermissionState, { label: string; color: string; bg: string }> => ({
  granted: { label: '허용됨', color: colors.green, bg: colors.greenSoft },
  denied: { label: '거부됨', color: colors.red, bg: colors.redSoft },
  undetermined: { label: '요청 전', color: colors.yellowText, bg: colors.yellowSoft },
  unavailable: { label: '이 환경 미지원', color: colors.text2, bg: colors.bg3 },
});

export default function Settings() {
  const router = useRouter();
  const colors = useColors();
  const PERM_LABEL = permLabel(colors);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const me = useStore((s) => s.me);
  const perms = useStore((s) => s.permissions);
  const setPermissions = useStore((s) => s.setPermissions);
  const backend = useStore((s) => s.backend);
  const setLocation = useStore((s) => s.setLocation);
  const ff = useStore((s) => s.devFastForward);
  const spawn = useStore((s) => s.devSpawnPassby);
  const spawnReply = useStore((s) => s.devSpawnReply);
  const update = useStore((s) => s.updateProfile);
  const reset = useStore((s) => s.resetAll);
  const signedIn = useStore((s) => s.signedIn);
  const confirmAsync = (title: string, body: string, fn: () => Promise<void>) => { if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) void fn(); return; } Alert.alert(title, body, [{ text: '취소', style: 'cancel' }, { text: title, style: 'destructive', onPress: () => void fn() }]); };
  const [showLoc, setShowLoc] = useState(false);

  const refresh = async () => {
    const loc = await getLocationPermission();
    const noti = await getNotificationPermission();
    setPermissions({ location: loc.foreground, backgroundLocation: loc.background, notifications: noti });
  };
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openSettings = () => Linking.openSettings().catch(() => {});
  const confirmReset = () => {
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm('모든 데이터를 지우고 처음부터 시작할까요?')) reset(); return; }
    Alert.alert('초기화', '모든 데이터를 지우고 처음부터 시작할까요?', [{ text: '취소', style: 'cancel' }, { text: '초기화', style: 'destructive', onPress: () => reset() }]);
  };
  const PermRow = ({ title, sub, state, onRequest }: { title: string; sub: string; state: PermissionState; onRequest: () => void }) => (
    <ListRow title={title} subtitle={sub} right={<Row><Pill label={PERM_LABEL[state].label} color={PERM_LABEL[state].bg} textColor={PERM_LABEL[state].color} />{state === 'undetermined' ? <Button title="허용" size="sm" onPress={onRequest} /> : state === 'denied' ? <Button title="설정 열기" size="sm" variant="secondary" onPress={openSettings} /> : null}</Row>} />
  );

  return (
    <Screen>
      <Header title="설정" right={<Pill label={backend === 'supabase' ? 'Supabase 연결' : '로컬 시뮬'} color={backend === 'supabase' ? colors.greenSoft : colors.yellowSoft} textColor={backend === 'supabase' ? colors.green : colors.yellowText} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Section title="기기 권한 (실제 상태)" action={{ label: '새로고침', onPress: refresh }}>
          <PermRow title="위치 (앱 사용 중)" sub="편지 출발지 · 머리 위 통과 판정" state={perms.location} onRequest={async () => { const r = await requestForegroundLocation(); setPermissions({ location: r }); }} />
          <PermRow title="위치 (항상 · 백그라운드)" sub="앱을 닫아도 통과 알림을 받으려면 필요 · Expo Go 미지원(dev build)" state={perms.backgroundLocation} onRequest={async () => { const r = await requestBackgroundLocation(); setPermissions({ backgroundLocation: r }); }} />
          <PermRow title="알림" sub={perms.pushToken ? `푸시 토큰 등록됨 · ${perms.pushToken.slice(0, 22)}…` : '머리 위 통과 · 답장 도착 · 채팅 (Expo Go Android는 로컬 알림만)'} state={perms.notifications} onRequest={async () => { const r = await requestNotificationPermission(); setPermissions({ notifications: r }); const t = await getPushToken(); if (t) { setPermissions({ pushToken: t }); registerPushToken(t).catch(() => {}); } }} />
          <ListRow title="백그라운드 위치 업데이트" subtitle="2km 이동마다 서버에 10km 격자 위치 전송" right={<Switch value={settings.backgroundLocation} onValueChange={async (v) => { if (v) { const ok = await startBackgroundLocation(); setSettings({ backgroundLocation: ok }); if (!ok) refresh(); } else { await stopBackgroundLocation(); setSettings({ backgroundLocation: false }); } }} trackColor={{ true: colors.blue }} />} />
        </Section>

        <Section title="화면">
          <ListRow title="테마" subtitle="시스템 · 라이트 · 다크 (인스타그램 다크 팔레트)" right={<Row>{(['system', 'light', 'dark'] as const).map((t) => <Chip key={t} label={t === 'system' ? '시스템' : t === 'light' ? '라이트' : '다크'} small selected={settings.theme === t} onPress={() => setSettings({ theme: t })} />)}</Row>} />
        </Section>

        <Section title="알림 · 햅틱">
          <ListRow title="앱 내 알림" subtitle="머리 위 통과 · 잡힘 · 답장 · 채팅" right={<Switch value={settings.notifications} onValueChange={(v) => setSettings({ notifications: v })} trackColor={{ true: colors.blue }} />} />
          <ListRow title="햅틱" subtitle="버튼 · 잡기 진동" right={<Switch value={settings.haptics} onValueChange={(v) => setSettings({ haptics: v })} trackColor={{ true: colors.blue }} />} />
        </Section>

        <Section title="내 위치" action={{ label: showLoc ? '닫기' : '변경', onPress: () => setShowLoc((v) => !v) }}>
          <ListRow title={`${me.location.city}, ${me.location.country}`} subtitle="친구에게는 50km 반경 · 서버에는 10km 격자로만 저장" left={<Icon name="map-pin" size={20} color={colors.red} />} />
          {showLoc ? <View style={{ padding: spacing.lg }}><LocationPicker value={me.location} onChange={(p) => { setLocation(p); pushProfile().catch(() => {}); }} compact /></View> : null}
        </Section>

        <Section title="계정 · 결제">
          <ListRow title={signedIn ? `${me.nickname} · ${me.auth?.provider === 'kakao' ? '카카오' : 'Google'} 로그인` : '비회원으로 둘러보는 중'} subtitle={signedIn ? (me.auth?.email ?? '가입됨') : '보내기·좋아요·댓글 때 가입 시트가 떠요'} right={signedIn ? <Button title="로그아웃" size="sm" variant="secondary" track="settings:logout" onPress={() => confirmAsync('로그아웃', '이 기기에서 로그아웃해요. 편지와 친구는 계정에 남아요.', async () => { stopSync(); await signOut(); reset(); })} /> : <Button title="가입" size="sm" track="settings:signup" onPress={() => openSignup('send')} />} />
          <ListRow title={`플랜: ${me.plan.toUpperCase()}`} subtitle={me.planExpiresAt ? `갱신 ${new Date(me.planExpiresAt).toLocaleDateString('ko-KR')}` : '무료'} right={<Button title="상점" size="sm" variant="secondary" onPress={() => router.push('/store')} />} />
          <ListRow title="결제 제공자" subtitle={purchases.name === 'revenuecat' ? 'RevenueCat (스토어 결제)' : 'Mock (테스트) · dev build + RevenueCat 키 설정 시 실결제'} />
          <ListRow title="백엔드" subtitle={supabaseEnabled ? 'Supabase (Auth · Postgres · Realtime · Edge Functions)' : 'EXPO_PUBLIC_SUPABASE_* 미설정 → 로컬 봇 시뮬레이션'} />
        </Section>

        <Section title="개발자 모드" right={<Switch value={settings.devMode} onValueChange={(v) => setSettings({ devMode: v })} trackColor={{ true: colors.blue }} />}>
          {settings.devMode ? (
            <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
              <T t="small" color={colors.text2}>시뮬 배속 (새 편지부터) · 걷기 5km/h × 배속 = 실제 체감</T>
              <Row>{[60, 120, 240, 600, 1200].map((x) => <Chip key={x} label={`${x}x`} small selected={settings.timeScale === x} onPress={() => setSettings({ timeScale: x })} />)}</Row>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button title="1분 빨리감기" size="sm" variant="secondary" onPress={() => ff(60_000)} />
                <Button title="10분 빨리감기" size="sm" variant="secondary" onPress={() => ff(600_000)} />
                <Button title="1시간 빨리감기" size="sm" variant="secondary" onPress={() => ff(3_600_000)} />
              </Row>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button title="머리 위 편지 소환" size="sm" icon="navigation" onPress={() => { spawn(); router.replace('/'); }} />
                <Button title="답장 편지 소환" size="sm" icon="inbox" onPress={() => { spawnReply(); router.replace('/letters'); }} />
                <Button title="+100 코인" size="sm" variant="secondary" onPress={() => update({ coins: me.coins + 100 })} />
              </Row>
            </View>
          ) : <T t="small" color={colors.text2} style={{ paddingHorizontal: spacing.lg }}>배속, 빨리감기, 편지 소환 등 테스트 도구</T>}
        </Section>

        <Section title="데이터">
          {signedIn ? <ListRow title="계정 삭제" subtitle="편지·친구·엽서·코인이 모두 지워져요 (되돌릴 수 없음)" right={<Button title="삭제" size="sm" variant="danger" track="settings:delete-account" onPress={() => confirmAsync('계정 삭제', '정말 삭제할까요? 모든 데이터가 지워지고 되돌릴 수 없어요.', async () => { stopSync(); await signOut(); reset(); })} />} /> : null}
          <View style={{ paddingHorizontal: spacing.lg }}><Button title="모든 데이터 초기화" variant="danger" onPress={confirmReset} /></View>
        </Section>
        <T t="caption" color={colors.text3} style={{ textAlign: 'center', marginTop: spacing.xl }}>WorldWideSomeone {Constants.expoConfig?.version ?? ''} · {Platform.OS} · {Constants.appOwnership ?? 'standalone'}</T>
      </ScrollView>
    </Screen>
  );
}
