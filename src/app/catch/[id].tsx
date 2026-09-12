import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import { Avatar, Button, Chip, Header, Icon, Paper, Pill, Row, Screen, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { ItemIcon, type ItemId } from '@/components/item-art';
import { Globe } from '@/components/globe/Globe';
import { VEHICLE_MAP } from '@/data/vehicles';
import { ITEM_MAP, PLAN_MAP } from '@/data/plans';
import { findCity, CITIES } from '@/data/cities';
import { genderLabel } from '@/data/profile';
import { describePlace } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { useStore, type ActionResult } from '@/store';
import type { LatLng } from '@/types';
import { radius, shadow, spacing, useColors } from '@/theme';
import { heavy, success, warn } from '@/engine/haptics';

type Result = { title: string; body: string; icon: ItemId };

export default function Catch() {
  const router = useRouter();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const now = useNow(4);
  const me = useStore((s) => s.me);
  const letter = useStore((s) => s.letters.find((l) => l.id === id));
  const passby = useStore((s) => s.passbys.find((p) => p.letterId === id));
  const dismiss = useStore((s) => s.dismissPassby);
  const catchLetter = useStore((s) => s.catchLetter);
  const peek = useStore((s) => s.peekLetter);
  const pull = useStore((s) => s.pullLetter);
  const redirect = useStore((s) => s.redirectLetter);
  const reroute = useStore((s) => s.rerouteLetter);
  const snail = useStore((s) => s.snailLetter);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<'actions' | 'reroute'>('actions');
  const [wps, setWps] = useState<LatLng[]>([]);
  const plan = PLAN_MAP[me.plan];
  const wobble = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { const loop = Animated.loop(Animated.sequence([Animated.timing(wobble, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }), Animated.timing(wobble, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' })])); loop.start(); return () => loop.stop(); }, [wobble]);
  useEffect(() => { if (result) { pop.setValue(0); Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }).start(); } }, [result, pop]);
  if (!letter) return <Screen><Header title="편지" /><T style={{ padding: spacing.lg }}>편지를 찾을 수 없어요</T></Screen>;

  const v = VEHICLE_MAP[letter.vehicle];
  const stampCity = findCity(letter.origin.city);
  const active = !!passby && !passby.resolved && passby.expiresAt > now;
  const total = passby ? passby.expiresAt - passby.at : 1;
  const remain = passby ? Math.max(0, passby.expiresAt - now) : 0;
  const frac = passby ? remain / total : 0;
  const R = 64, C = 2 * Math.PI * R;
  const hasTarget = !!(letter.target.field || letter.target.gender || letter.target.job || letter.target.hobby);
  const peeked = !!passby?.peeked;
  const peekLeft = Math.max(0, plan.dailyPeeks - (me.quota.date === new Date().toDateString() ? me.quota.peeks : 0)) + me.inventory.peek;
  const pullLeft = Math.max(0, plan.dailyPulls - (me.quota.date === new Date().toDateString() ? me.quota.pulls : 0)) + me.inventory.pull;
  const finish = (r: Result, next?: () => void, delay = 1500) => { setResult(r); setTimeout(() => (next ? next() : router.back()), delay); };
  const doCatch = () => { heavy(); catchLetter(letter.id); success(); finish({ title: '잡았다!', body: `${letter.origin.city}에서 온 편지. 보낸 사람의 프로필이 공개돼요`, icon: 'catch' }, () => router.replace({ pathname: '/letter/[id]', params: { id: letter.id, reveal: '1' } } as any), 1100); };
  const outcome = (r: ActionResult, done: Result, stay = false) => {
    if (r === 'immune') { warn(); finish({ title: '건드릴 수 없어요', body: `${v.name}은(는) 이 장난에 면역이에요`, icon: 'shield' }); }
    else if (r === 'defended') { warn(); finish({ title: '튕겨나갔어요!', body: '발신자가 방어권을 장착했어요. 편지는 무사히 갑니다', icon: 'shield' }); }
    else if (r === 'quota') { warn(); finish({ title: '한도를 다 썼어요', body: '플러스/프로 플랜이나 상점에서 더 얻을 수 있어요', icon: 'bag' }, () => router.push('/store'), 1400); }
    else if (r === 'gone') { warn(); finish({ title: '이미 착륙했어요', body: '빠른 배달원은 지나가자마자 도착해요. 착륙한 편지는 잡기만 할 수 있어요', icon: 'pin' }); }
    else if (r === 'limit') { warn(); setResult({ title: '이미 한 번 끌려간 편지예요', body: '편지당 끌어오기는 1회만', icon: 'magnet' }); setTimeout(() => setResult(null), 1500); }
    else if (stay) { success(); setResult(done); setTimeout(() => setResult(null), 1400); }
    else { heavy(); finish(done); }
  };
  const doPeek = () => outcome(peek(letter.id), { title: '엿봤어요', body: '아래에서 내용을 볼 수 있어요. 마음에 들면 끌어오세요', icon: 'lens' }, true);
  const doPull = () => outcome(pull(letter.id), { title: '끌어왔어요!', body: '편지가 내 위치로 방향을 바꿨어요. 도착하면 집어가세요', icon: 'magnet' }, false);
  const doRedirect = (a: 'sunk' | 'space') => outcome(redirect(letter.id, a), a === 'sunk' ? { title: '침수!', body: '몇 시간 뒤 떠오르거나, 주인이 건져내야 다시 가요', icon: 'wave' } : { title: '발사!', body: '편지가 우주로 날아갔어요', icon: 'planet' });
  const doSnail = () => outcome(snail(letter.id), { title: '달팽이 붙였어요', body: '5분 동안 10배 느려져요', icon: 'snail' });
  const doReroute = () => outcome(reroute(letter.id, wps), { title: '경로를 바꿨어요', body: `경유지 ${wps.length}곳을 지나 원래 목적지로 가요`, icon: 'compass' });
  const peekPrice = ITEM_MAP.peek5;
  const pullPrice = ITEM_MAP.pull1;

  const ACTIONS = [
    { key: 'peek', icon: 'lens' as ItemId, label: peeked ? '엿봤음' : '엿보기', sub: peekLeft > 0 ? `남은 ${peekLeft}회` : `${peekPrice.coins} SC`, onPress: doPeek, disabled: peeked },
    { key: 'pull', icon: 'magnet' as ItemId, label: '끌어오기', sub: pullLeft > 0 ? `남은 ${pullLeft}회` : `${pullPrice.coins} SC`, onPress: doPull },
    { key: 'reroute', icon: 'compass' as ItemId, label: '경로 바꾸기', sub: `경유지 ${plan.maxWaypoints}개`, onPress: () => setMode('reroute') },
    { key: 'snail', icon: 'snail' as ItemId, label: '달팽이', sub: '5분 느리게', onPress: doSnail },
    { key: 'sunk', icon: 'wave' as ItemId, label: '침수', sub: '몇 시간 정지', onPress: () => doRedirect('sunk') },
    { key: 'space', icon: 'rocket' as ItemId, label: '우주로', sub: '안녕', onPress: () => doRedirect('space') },
  ];

  return (
    <Screen>
      <Header title={active ? '머리 위를 지나가요!' : passby?.resolved === 'caught' ? '이미 잡은 편지' : passby?.resolved === 'pulled' ? '끌어온 편지 · 오는 중' : '지나갔어요'} subtitle={`${letter.origin.city}, ${letter.origin.country} 출발 · ${v.name} ${v.speedKmh.toLocaleString()}km/h`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[...c.sky] as any} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ height: 240, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Globe size={Math.min(width, 480)} letters={[letter]} me={me.location} meAvatar={me.avatar} focusLetterId={letter.id} fps={24} interactive={false} zoom={1.5} showRoutes="focus" /></View>
          <View style={{ marginTop: -70, alignItems: 'center', justifyContent: 'center', width: R * 2 + 16, height: R * 2 + 16 }}>
            <Svg width={R * 2 + 16} height={R * 2 + 16} style={{ position: 'absolute' }}><Circle cx={R + 8} cy={R + 8} r={R} stroke={c.line} strokeWidth={6} fill="none" opacity={0.5} /><Circle cx={R + 8} cy={R + 8} r={R} stroke={frac > 0.3 ? c.blue : c.red} strokeWidth={6} fill="none" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${R + 8} ${R + 8})`} /></Svg>
            <Animated.View style={{ transform: [{ translateY: wobble.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) }, { rotate: wobble.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] }}><VehicleIcon id={letter.vehicle} size={100} bubble snail={!!letter.penalty && now < letter.penalty.until} /></Animated.View>
            <View style={[styles.timer, { backgroundColor: c.bg, borderColor: c.line }]}><T t="bodyStrong" color={frac > 0.3 ? c.text : c.red}>{Math.ceil(remain / 1000)}s</T></View>
          </View>
          {letter.shield ? <Pill label="방어권 장착 · 장난이 튕겨나가요" icon={<ItemIcon id="shield" size={12} />} color={c.bubble} /> : v.trait ? <Pill label={v.trait} color={c.bubble} /> : null}
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10}><Avatar anonymous size={44} ring="ig" /><View><T t="bodyStrong">??? <T t="small" color={c.text2}>· 잡으면 프로필 공개</T></T><T t="small" color={c.text2}>{stampCity?.flag ?? '📮'} {letter.origin.city} 스탬프{letter.redirects ? ` · 경로변경 ${letter.redirects}회` : ''}{letter.pulls ? ' · 이미 끌려감' : ''}</T></View></Row>
            <Pill label={v.name} />
          </Row>
          {peeked ? <Paper><Row gap={4}><ItemIcon id="lens" size={12} /><T t="caption" color={c.paperMuted}>엿본 내용</T></Row><T style={{ color: c.paperText, fontSize: 16, lineHeight: 26, marginTop: 4 }}>{letter.text}</T></Paper> : null}
          {hasTarget ? <View style={{ gap: 4 }}><T t="caption" color={c.text2}>받는 사람 조건 {passby?.canCatch ? '· 내 프로필 일치 ✓' : '· 내 프로필과 달라요 (잡기 불가 · 나머지는 가능)'}</T><Row style={{ flexWrap: 'wrap' }} gap={4}>{letter.target.field ? <Chip label={letter.target.field} small selected={passby?.canCatch} /> : null}{letter.target.gender ? <Chip label={genderLabel(letter.target.gender)} small selected={passby?.canCatch} /> : null}{letter.target.job ? <Chip label={letter.target.job} small selected={passby?.canCatch} /> : null}{letter.target.hobby ? <Chip label={letter.target.hobby} small selected={passby?.canCatch} /> : null}</Row></View> : null}

          {mode === 'actions' ? (<>
            <Button title={active && passby?.canCatch ? '잡기' : active ? '조건이 맞지 않아요' : '지나갔어요'} size="lg" full icon="download" disabled={!active || !passby?.canCatch} onPress={doCatch} />
            <T t="caption" color={c.text2} style={{ textAlign: 'center' }}>엿보기·끌어오기는 결제/플랜 한도 · 장난은 발신자의 방어권에 막힐 수 있어요</T>
            <View style={styles.grid}>
              {ACTIONS.map((a) => (
                <Pressable key={a.key} disabled={!active || a.disabled} onPress={a.onPress} style={({ pressed }) => [styles.action, { borderColor: c.line }, (!active || a.disabled) && { opacity: 0.4 }, pressed && { backgroundColor: c.bg3 }, (a.key === 'peek' || a.key === 'pull') && { borderColor: c.purple, backgroundColor: c.purpleSoft }]}>
                  <ItemIcon id={a.icon} size={32} /><T t="smallStrong">{a.label}</T><T t="caption" color={c.text3}>{a.sub}</T>
                </Pressable>
              ))}
            </View>
            <Button title="그냥 보내주기" variant="ghost" track="catch:letgo" onPress={() => { if (passby && !passby.resolved) dismiss(passby.id); router.back(); }} />
          </>) : (
            <View style={{ gap: spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}><T t="h2">경로 바꾸기 · 경유지 {wps.length}/{plan.maxWaypoints}</T><Pressable onPress={() => { setMode('actions'); setWps([]); }}><Icon name="x" size={20} /></Pressable></Row>
              <T t="small" color={c.text2}>편지는 지금 위치에서 내가 찍은 경유지를 거쳐 원래 목적지로 가요.{me.plan === 'free' ? ' 플러스 2개, 프로 3개.' : ''}</T>
              <LinearGradient colors={[...c.sky] as any} style={{ borderRadius: radius.lg, alignItems: 'center', paddingVertical: 8 }}><Globe size={Math.min(width - 32, 300)} letters={[letter]} me={me.location} meAvatar={me.avatar} pickedPoints={wps} focusLetterId={wps.length ? null : letter.id} focusPoint={wps[wps.length - 1] ?? null} autoRotate={false} fps={24} onSelectPoint={(p) => wps.length < plan.maxWaypoints && setWps([...wps, p])} showRoutes="focus" /><T t="caption" color={c.text2}>지구를 탭해 경유지를 찍어요</T></LinearGradient>
              <Row style={{ flexWrap: 'wrap' }} gap={6}>{CITIES.slice(0, 10).map((ct) => <Chip key={ct.city} label={`${ct.flag} ${ct.city}`} small onPress={() => wps.length < plan.maxWaypoints && setWps([...wps, { lat: ct.lat, lng: ct.lng }])} />)}</Row>
              <Row style={{ flexWrap: 'wrap' }} gap={6}>{wps.map((w, i) => <Pill key={i} label={`${i + 1}. ${describePlace(w).city}`} color={c.yellowSoft} textColor={c.yellowText} />)}</Row>
              <Row><Button title="초기화" variant="secondary" onPress={() => setWps([])} /><Button title={`경로 적용 (${wps.length})`} style={{ flex: 1 }} disabled={wps.length === 0 || !active} onPress={doReroute} /></Row>
            </View>
          )}
        </View>
      </ScrollView>
      {result ? <View style={styles.overlay}><Animated.View style={[{ alignItems: 'center', backgroundColor: c.bg, borderRadius: 24, padding: 28, width: width - 64, transform: [{ scale: pop }], opacity: pop }, shadow.float]}><View style={{ marginBottom: 10 }}><ItemIcon id={result.icon} size={88} /></View><T t="title" style={{ textAlign: 'center' }}>{result.title}</T><T t="body" color={c.text2} style={{ textAlign: 'center', marginTop: 6 }}>{result.body}</T></Animated.View></View> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  timer: { position: 'absolute', top: -6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
