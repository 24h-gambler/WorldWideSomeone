import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import { Avatar, Button, Chip, Header, Icon, Pill, Row, Screen, T, type FeatherName } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { Globe } from '@/components/globe/Globe';
import { VEHICLE_MAP } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { findCity, CITIES } from '@/data/cities';
import { genderLabel } from '@/data/profile';
import { describePlace } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { useStore } from '@/store';
import type { LatLng } from '@/types';
import { colors, radius, shadow, spacing } from '@/theme';
import { heavy, success, warn } from '@/engine/haptics';

type Result = { title: string; body: string; emoji: string };

export default function Catch() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const now = useNow(4);
  const me = useStore((s) => s.me);
  const letter = useStore((s) => s.letters.find((l) => l.id === id));
  const passby = useStore((s) => s.passbys.find((p) => p.letterId === id));
  const catchLetter = useStore((s) => s.catchLetter);
  const redirect = useStore((s) => s.redirectLetter);
  const reroute = useStore((s) => s.rerouteLetter);
  const snail = useStore((s) => s.snailLetter);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<'actions' | 'reroute'>('actions');
  const [wps, setWps] = useState<LatLng[]>([]);
  const plan = PLAN_MAP[me.plan];

  const wobble = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(wobble, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }), Animated.timing(wobble, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' })]));
    loop.start();
    return () => loop.stop();
  }, [wobble]);
  useEffect(() => { if (result) { pop.setValue(0); Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }).start(); } }, [result, pop]);

  if (!letter) return <Screen><Header title="편지" /><T style={{ padding: spacing.lg }}>편지를 찾을 수 없어요</T></Screen>;

  const v = VEHICLE_MAP[letter.vehicle];
  const stampCity = findCity(letter.origin.city);
  const active = !!passby && !passby.resolved && passby.expiresAt > now;
  const total = passby ? passby.expiresAt - passby.at : 1;
  const remain = passby ? Math.max(0, passby.expiresAt - now) : 0;
  const frac = passby ? remain / total : 0;
  const R = 64;
  const C = 2 * Math.PI * R;
  const hasTarget = !!(letter.target.field || letter.target.gender || letter.target.job || letter.target.hobby);
  const finish = (r: Result, next?: () => void, delay = 1500) => { setResult(r); setTimeout(() => (next ? next() : router.back()), delay); };

  const doCatch = () => { heavy(); catchLetter(letter.id); success(); finish({ title: '잡았다!', body: `${letter.origin.city}에서 온 편지. +10 코인`, emoji: '🫳' }, () => router.replace({ pathname: '/letter/[id]', params: { id: letter.id, reveal: '1' } } as any), 1100); };
  const handleOutcome = (r: 'defended' | 'done' | 'immune' | 'limit', done: Result) => {
    if (r === 'immune') { warn(); finish({ title: '드래곤은 건드릴 수 없어요', body: '이 편지는 장난에 면역이에요', emoji: '🐉' }); }
    else if (r === 'defended') { warn(); finish({ title: '튕겨나갔어요!', body: '발신자가 방어권을 장착했어요. 편지는 무사히 갑니다', emoji: '🛡️' }); }
    else if (r === 'limit') { warn(); setResult(null); }
    else { heavy(); finish(done); }
  };
  const doRedirect = (a: 'returned' | 'ocean' | 'space') => handleOutcome(redirect(letter.id, a), a === 'ocean' ? { title: '풍덩!', body: '편지가 바다에 빠졌어요', emoji: '🌊' } : a === 'space' ? { title: '발사!', body: '편지가 우주로 날아갔어요', emoji: '🪐' } : { title: '되돌려보냈어요', body: '발신자에게 돌아갑니다', emoji: '↩️' });
  const doSnail = () => handleOutcome(snail(letter.id), { title: '달팽이 붙였어요', body: '5분 동안 10배 느려져요', emoji: '🐌' });
  const doReroute = () => handleOutcome(reroute(letter.id, wps), { title: '경로를 바꿨어요', body: `경유지 ${wps.length}곳을 지나 원래 목적지로 가요`, emoji: '🧭' });

  const ACTIONS: { key: string; icon: FeatherName | string; label: string; sub: string; onPress: () => void }[] = [
    { key: 'reroute', icon: '🧭', label: '경로 바꾸기', sub: `경유지 ${plan.maxWaypoints}개`, onPress: () => setMode('reroute') },
    { key: 'snail', icon: '🐌', label: '달팽이 붙이기', sub: '5분 느리게', onPress: doSnail },
    { key: 'return', icon: '↩️', label: '되돌리기', sub: '발신자에게', onPress: () => doRedirect('returned') },
    { key: 'ocean', icon: '🌊', label: '바다에', sub: '풍덩', onPress: () => doRedirect('ocean') },
    { key: 'space', icon: '🚀', label: '우주로', sub: '안녕', onPress: () => doRedirect('space') },
  ];

  return (
    <Screen>
      <Header title={active ? '머리 위를 지나가요!' : passby?.resolved === 'caught' ? '이미 잡은 편지' : '지나갔어요'} subtitle={`${letter.origin.city}, ${letter.origin.country} 출발 · ${v.name} ${v.speedKmh.toLocaleString()}km/h`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#F4FAFF', '#DDEEFF']} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ height: 240, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Globe size={Math.min(width, 480)} letters={[letter]} me={me.location} meAvatar={me.avatar} focusLetterId={letter.id} fps={24} interactive={false} zoom={1.5} />
          </View>
          <View style={{ marginTop: -70, alignItems: 'center', justifyContent: 'center', width: R * 2 + 16, height: R * 2 + 16 }}>
            <Svg width={R * 2 + 16} height={R * 2 + 16} style={{ position: 'absolute' }}>
              <Circle cx={R + 8} cy={R + 8} r={R} stroke="rgba(0,0,0,0.06)" strokeWidth={6} fill="none" />
              <Circle cx={R + 8} cy={R + 8} r={R} stroke={frac > 0.3 ? colors.blue : colors.red} strokeWidth={6} fill="none" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${R + 8} ${R + 8})`} />
            </Svg>
            <Animated.View style={{ transform: [{ translateY: wobble.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) }, { rotate: wobble.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] }}>
              <VehicleIcon id={letter.vehicle} size={96} bubble snail={!!letter.penalty && now < letter.penalty.until} />
            </Animated.View>
            <View style={styles.timer}><T t="bodyStrong" color={frac > 0.3 ? colors.text : colors.red}>{Math.ceil(remain / 1000)}s</T></View>
          </View>
          {letter.shield ? <Pill label="방어권 장착 · 장난이 튕겨나가요" icon="🛡️" color="#fff" /> : null}
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10}>
              <Avatar anonymous size={44} ring="ig" />
              <View><T t="bodyStrong">??? <T t="small" color={colors.text2}>· 익명</T></T><T t="small" color={colors.text2}>{stampCity?.flag ?? '📮'} {letter.origin.city} 스탬프{letter.redirects ? ` · 경로변경 ${letter.redirects}회` : ''}</T></View>
            </Row>
            <Pill label={v.name} icon={v.emoji} />
          </Row>
          {hasTarget ? (
            <View style={{ gap: 4 }}>
              <T t="caption" color={colors.text2}>받는 사람 조건 {passby?.canCatch ? '· 내 프로필 일치 ✓' : '· 내 프로필과 달라요 (경로 변경만 가능)'}</T>
              <Row style={{ flexWrap: 'wrap' }} gap={4}>
                {letter.target.field ? <Chip label={letter.target.field} small selected={passby?.canCatch} /> : null}
                {letter.target.gender ? <Chip label={genderLabel(letter.target.gender)} small selected={passby?.canCatch} /> : null}
                {letter.target.job ? <Chip label={letter.target.job} small selected={passby?.canCatch} /> : null}
                {letter.target.hobby ? <Chip label={letter.target.hobby} small selected={passby?.canCatch} /> : null}
              </Row>
            </View>
          ) : null}

          {mode === 'actions' ? (
            <>
              <Button title={active && passby?.canCatch ? '잡기' : active ? '조건이 맞지 않아요' : '지나갔어요'} size="lg" full icon="download" disabled={!active || !passby?.canCatch} onPress={doCatch} />
              <T t="caption" color={colors.text2} style={{ textAlign: 'center' }}>잡으면 편지를 읽고 답장을 보낼 수 있어요 · 장난은 발신자의 방어권에 막힐 수 있어요</T>
              <View style={styles.grid}>
                {ACTIONS.map((a) => (
                  <Pressable key={a.key} disabled={!active} onPress={a.onPress} style={({ pressed }) => [styles.action, !active && { opacity: 0.4 }, pressed && { backgroundColor: colors.bg3 }]}>
                    <T style={{ fontSize: 24 }}>{a.icon}</T>
                    <T t="smallStrong">{a.label}</T>
                    <T t="caption" color={colors.text3}>{a.sub}</T>
                  </Pressable>
                ))}
              </View>
              <Button title="그냥 보내주기" variant="ghost" onPress={() => router.back()} />
            </>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="h2">경로 바꾸기 · 경유지 {wps.length}/{plan.maxWaypoints}</T>
                <Pressable onPress={() => { setMode('actions'); setWps([]); }}><Icon name="x" size={20} /></Pressable>
              </Row>
              <T t="small" color={colors.text2}>편지는 지금 위치에서 내가 찍은 경유지를 거쳐 원래 목적지로 가요. 친구 머리 위로 보내주거나, 멀리 돌아가게 할 수 있어요.{me.plan === 'free' ? ' 플러스는 2개, 프로는 3개까지.' : ''}</T>
              <LinearGradient colors={['#F7FBFF', '#EAF4FF']} style={{ borderRadius: radius.lg, alignItems: 'center', paddingVertical: 8 }}>
                <Globe size={Math.min(width - 32, 300)} letters={[letter]} me={me.location} meAvatar={me.avatar} pickedPoints={wps} focusLetterId={wps.length ? null : letter.id} focusPoint={wps[wps.length - 1] ?? null} autoRotate={false} fps={24} onSelectPoint={(p) => wps.length < plan.maxWaypoints && setWps([...wps, p])} />
                <T t="caption" color={colors.text2}>지구를 탭해 경유지를 찍어요</T>
              </LinearGradient>
              <Row style={{ flexWrap: 'wrap' }} gap={6}>
                {CITIES.slice(0, 10).map((c) => <Chip key={c.city} label={`${c.flag} ${c.city}`} small onPress={() => wps.length < plan.maxWaypoints && setWps([...wps, { lat: c.lat, lng: c.lng }])} />)}
              </Row>
              <Row style={{ flexWrap: 'wrap' }} gap={6}>
                {wps.map((w, i) => <Pill key={i} label={`${i + 1}. ${describePlace(w).city}`} color={colors.yellowSoft} textColor="#8A6D00" />)}
              </Row>
              <Row>
                <Button title="초기화" variant="secondary" onPress={() => setWps([])} />
                <Button title={`경로 적용 (${wps.length})`} style={{ flex: 1 }} disabled={wps.length === 0 || !active} onPress={doReroute} />
              </Row>
              {me.plan !== 'pro' ? <Button title="경유지 더 쓰기 · 플러스/프로" variant="gradient" size="sm" onPress={() => router.push('/store')} /> : null}
            </View>
          )}
        </View>
      </ScrollView>

      {result ? (
        <View style={styles.overlay}>
          <Animated.View style={[{ alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 28, width: width - 64, transform: [{ scale: pop }], opacity: pop }, shadow.float]}>
            <T style={{ fontSize: 72, lineHeight: 84 }}>{result.emoji}</T>
            <T t="title" style={{ textAlign: 'center' }}>{result.title}</T>
            <T t="body" color={colors.text2} style={{ textAlign: 'center', marginTop: 6 }}>{result.body}</T>
          </Animated.View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timer: { position: 'absolute', top: -6, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, gap: 2 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
