import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import { Avatar, Button, Chip, Row, Screen, T } from '@/components/ui';
import { VEHICLE_MAP } from '@/data/vehicles';
import { findCity } from '@/data/cities';
import { genderLabel } from '@/data/profile';
import { useNow } from '@/hooks/use-now';
import { useStore } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { heavy, success, warn } from '@/engine/haptics';
import { VehicleIcon } from '@/components/vehicle-icon';

type Result = { kind: 'caught' | 'returned' | 'ocean' | 'space' | 'defended' | 'immune' | 'missed'; title: string; body: string; emoji: string };

export default function Catch() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const now = useNow(4);
  const letter = useStore((s) => s.letters.find((l) => l.id === id));
  const passby = useStore((s) => s.passbys.find((p) => p.letterId === id));
  const catchLetter = useStore((s) => s.catchLetter);
  const redirect = useStore((s) => s.redirectLetter);
  const [result, setResult] = useState<Result | null>(null);

  const wobble = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(wobble, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wobble]);

  useEffect(() => {
    if (result) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }).start();
    }
  }, [result, pop]);

  if (!letter) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <T t="title">편지를 찾을 수 없어요</T>
        <Button title="돌아가기" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  const v = VEHICLE_MAP[letter.vehicle];
  const stampCity = findCity(letter.origin.city);
  const active = passby && !passby.resolved && passby.expiresAt > now;
  const total = passby ? passby.expiresAt - passby.at : 1;
  const remain = passby ? Math.max(0, passby.expiresAt - now) : 0;
  const frac = passby ? remain / total : 0;
  const R = 120;
  const C = 2 * Math.PI * R;
  const hasTarget = !!(letter.target.field || letter.target.gender || letter.target.job || letter.target.hobby);

  const doCatch = () => {
    heavy();
    catchLetter(letter.id);
    success();
    setResult({ kind: 'caught', title: '잡았다!', body: `${letter.origin.city}에서 온 편지를 잡았어요. +10 코인`, emoji: '🫳' });
    setTimeout(() => router.replace({ pathname: '/letter/[id]', params: { id: letter.id, reveal: '1' } } as any), 1100);
  };

  const doRedirect = (action: 'returned' | 'ocean' | 'space') => {
    const r = redirect(letter.id, action);
    if (r === 'immune') {
      warn();
      setResult({ kind: 'immune', title: '드래곤은 건드릴 수 없어요', body: '이 편지는 장난에 면역이에요', emoji: '🐉' });
    } else if (r === 'defended') {
      warn();
      setResult({ kind: 'defended', title: '튕겨나갔어요!', body: '발신자가 방어권을 장착했어요. 편지는 무사히 날아갑니다', emoji: '🛡️' });
    } else {
      heavy();
      const map = {
        returned: { title: '되돌려보냈어요', body: '편지가 발신자에게 돌아갑니다', emoji: '↩️' },
        ocean: { title: '풍덩!', body: `편지가 ${oceanOf(letter)}에 빠졌어요`, emoji: '🌊' },
        space: { title: '발사!', body: '편지가 우주로 날아갔어요. 안녕…', emoji: '🪐' },
      } as const;
      setResult({ kind: action, ...map[action] });
    }
    setTimeout(() => router.back(), 1600);
  };

  return (
    <Screen padded={false}>
      <LinearGradient colors={['#1A1147', colors.bg, colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.xl }}>
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <T t="caption" color={colors.accent} style={{ letterSpacing: 2 }}>{active ? 'PASSING OVERHEAD' : passby?.resolved ? 'RESOLVED' : 'MISSED'}</T>
          <T t="title" style={{ textAlign: 'center' }}>{active ? `${v.name}가 머리 위를 지나가요!` : passby?.resolved === 'caught' ? '이미 잡은 편지예요' : '놓쳤어요…'}</T>
          <T t="small" color={colors.textDim}>{letter.origin.city}, {letter.origin.country} 에서 출발 · {v.speedKmh.toLocaleString()} km/h</T>
        </View>

        {/* 타이머 링 + 물체 */}
        <View style={{ width: R * 2 + 24, height: R * 2 + 24, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={R * 2 + 24} height={R * 2 + 24} style={{ position: 'absolute' }}>
            <Circle cx={R + 12} cy={R + 12} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={8} fill="none" />
            <Circle cx={R + 12} cy={R + 12} r={R} stroke={frac > 0.3 ? colors.mint : colors.danger} strokeWidth={8} fill="none" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${R + 12} ${R + 12})`} />
          </Svg>
          <Animated.View style={{ transform: [{ translateY: wobble.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) }, { rotate: wobble.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) }] }}>
            <VehicleIcon id={letter.vehicle} size={130} />
          </Animated.View>
          {letter.shield ? <View style={styles.shieldTag}><T t="caption">🛡️ 방어권 장착</T></View> : null}
          <View style={styles.timer}><T t="h2" color={frac > 0.3 ? colors.text : colors.danger}>{Math.ceil(remain / 1000)}s</T></View>
        </View>

        {/* 발신자 카드 */}
        <View style={styles.sender}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <Avatar anonymous size={44} />
              <View>
                <T t="bodyStrong">??? <T t="small" color={colors.textDim}>· 익명</T></T>
                <T t="small" color={colors.textDim}>{stampCity?.flag ?? '📮'} {letter.origin.city} 스탬프</T>
              </View>
            </Row>
            <Chip label={v.name} small selected color={v.color} />
          </Row>
          {hasTarget ? (
            <View style={{ marginTop: spacing.sm }}>
              <T t="caption" color={colors.textDim}>받는 사람 조건</T>
              <Row style={{ flexWrap: 'wrap', marginTop: 4 }}>
                {letter.target.field ? <Chip label={letter.target.field} small selected={passby?.canCatch} /> : null}
                {letter.target.gender ? <Chip label={genderLabel(letter.target.gender)} small color={colors.accent} selected={passby?.canCatch} /> : null}
                {letter.target.job ? <Chip label={letter.target.job} small color={colors.sky} selected={passby?.canCatch} /> : null}
                {letter.target.hobby ? <Chip label={letter.target.hobby} small color={colors.mint} selected={passby?.canCatch} /> : null}
              </Row>
              {!passby?.canCatch ? <T t="caption" color={colors.danger} style={{ marginTop: 4 }}>내 프로필과 조건이 맞지 않아 구경만 할 수 있어요</T> : null}
            </View>
          ) : null}
        </View>

        {/* 액션 */}
        <View style={{ width: '100%', gap: spacing.md }}>
          <Button title={active && passby?.canCatch ? '🫳 잡기' : active ? '조건이 맞지 않아요' : '지나갔어요'} size="lg" full disabled={!active || !passby?.canCatch} onPress={doCatch} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Button title="되돌리기" icon="↩️" size="sm" variant="secondary" disabled={!active} onPress={() => doRedirect('returned')} style={{ flex: 1 }} />
            <Button title="바다에" icon="🌊" size="sm" variant="secondary" disabled={!active} onPress={() => doRedirect('ocean')} style={{ flex: 1 }} />
            <Button title="우주로" icon="🚀" size="sm" variant="secondary" disabled={!active} onPress={() => doRedirect('space')} style={{ flex: 1 }} />
          </Row>
          <Button title="그냥 보내주기" variant="ghost" size="sm" onPress={() => router.back()} />
        </View>
      </View>

      {result ? (
        <View style={styles.overlay}>
          <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop }], opacity: pop }}>
            <T style={{ fontSize: 96, lineHeight: 110 }}>{result.emoji}</T>
            <T t="hero" style={{ textAlign: 'center' }}>{result.title}</T>
            <T t="body" color={colors.textDim} style={{ textAlign: 'center', marginTop: 6, paddingHorizontal: 40 }}>{result.body}</T>
          </Animated.View>
        </View>
      ) : null}
      <View style={{ width }} />
    </Screen>
  );
}

function oceanOf(letter: { destination: { lng: number } }) {
  const lng = letter.destination.lng;
  if (lng > 20 && lng < 147) return '인도양';
  if (lng >= -70 && lng <= 20) return '대서양';
  return '태평양';
}

const styles = StyleSheet.create({
  shieldTag: { position: 'absolute', bottom: 4, backgroundColor: 'rgba(90,184,255,0.2)', borderColor: colors.sky, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  timer: { position: 'absolute', top: -8, backgroundColor: colors.bgElevated, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  sender: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,11,26,0.92)', alignItems: 'center', justifyContent: 'center' },
});
