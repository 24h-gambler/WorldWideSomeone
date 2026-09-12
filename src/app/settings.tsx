import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LocationPicker } from '@/components/location-picker';
import { Button, Card, Chip, Header, Row, Screen, Section, T } from '@/components/ui';
import { useStore } from '@/store';
import { colors, spacing } from '@/theme';

export default function Settings() {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const me = useStore((s) => s.me);
  const setLocation = useStore((s) => s.setLocation);
  const ff = useStore((s) => s.devFastForward);
  const spawn = useStore((s) => s.devSpawnPassby);
  const update = useStore((s) => s.updateProfile);
  const reset = useStore((s) => s.resetAll);
  const [showLoc, setShowLoc] = useState(false);

  const confirmReset = () => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm('모든 데이터를 지우고 처음부터 시작할까요?')) reset();
      return;
    }
    Alert.alert('초기화', '모든 데이터를 지우고 처음부터 시작할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: () => reset() },
    ]);
  };

  return (
    <Screen>
      <Header title="설정" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View><T t="bodyStrong">알림</T><T t="small" color={colors.textDim}>머리 위 통과 · 잡힘 · 친구 요청</T></View>
            <Switch value={settings.notifications} onValueChange={(v) => setSettings({ notifications: v })} trackColor={{ true: colors.accent }} />
          </Row>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View><T t="bodyStrong">햅틱</T><T t="small" color={colors.textDim}>버튼·잡기 진동</T></View>
            <Switch value={settings.haptics} onValueChange={(v) => setSettings({ haptics: v })} trackColor={{ true: colors.accent }} />
          </Row>
        </Card>

        <Section title="내 위치" right={<Button title={showLoc ? '닫기' : '변경'} size="sm" variant="secondary" onPress={() => setShowLoc((v) => !v)} />}>
          <Card>
            <T t="body">📍 {me.location.city}, {me.location.country}</T>
            <T t="small" color={colors.textDim}>친구에게는 50km 반경으로만 보여요 (고정)</T>
          </Card>
          {showLoc ? (
            <View style={{ marginTop: spacing.md }}>
              <LocationPicker value={me.location} onChange={(p) => setLocation(p)} compact />
            </View>
          ) : null}
        </Section>

        <Section title="개발자 모드" right={<Switch value={settings.devMode} onValueChange={(v) => setSettings({ devMode: v })} trackColor={{ true: colors.primary }} />}>
          {settings.devMode ? (
            <Card style={{ gap: spacing.md }}>
              <View>
                <T t="small" color={colors.textDim} style={{ marginBottom: 6 }}>시뮬 시간 배속 (새 편지부터 적용)</T>
                <Row>
                  {[60, 120, 240, 600].map((x) => <Chip key={x} label={`${x}x`} small selected={settings.timeScale === x} onPress={() => setSettings({ timeScale: x })} />)}
                </Row>
              </View>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button title="1분 빨리감기" size="sm" variant="secondary" onPress={() => ff(60_000)} />
                <Button title="5분 빨리감기" size="sm" variant="secondary" onPress={() => ff(300_000)} />
              </Row>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button title="머리 위 편지 소환" size="sm" variant="mint" icon="✈️" onPress={() => { spawn(); router.replace('/'); }} />
                <Button title="+100 코인" size="sm" variant="gold" onPress={() => update({ coins: me.coins + 100 })} />
              </Row>
              <T t="caption" color={colors.textFaint}>MVP는 서버 없이 봇 60명이 편지를 보내는 시뮬레이션이에요. 배속은 편지 비행 시간에만 영향을 줘요.</T>
            </Card>
          ) : (
            <T t="small" color={colors.textDim}>시뮬 배속, 빨리감기, 편지 소환 등 테스트 도구</T>
          )}
        </Section>

        <Section title="계정">
          <Button title="모든 데이터 초기화" variant="danger" onPress={confirmReset} />
        </Section>
        <T t="caption" color={colors.textFaint} style={{ marginTop: spacing.xl, textAlign: 'center' }}>WorldWideSomeone · MVP 0.1 · 서버 연동 전 클라이언트 시뮬</T>
      </ScrollView>
    </Screen>
  );
}
