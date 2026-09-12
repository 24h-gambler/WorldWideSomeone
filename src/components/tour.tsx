/**
 * 첫 진입 투어 — 홈에서 한 군데씩 짧은 안내 + CTA. 부드러운 페이드/슬라이드. 가입 얘기는 하지 않는다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Icon, Row, T, type FeatherName } from '@/components/ui';
import { useStore } from '@/store';
import { track } from '@/services/analytics';
import { radius, shadow, spacing, useColors } from '@/theme';

type Step = { key: string; icon: FeatherName; title: string; body: string; cta: string; anchor: 'top' | 'bottom' | 'middle' };
const STEPS: Step[] = [
  { key: 'globe', icon: 'globe', title: '지금도 편지가 날아요', body: '배달원을 탭하면 어디서 왔는지, 어디로 가는지 보여요.', cta: '다음', anchor: 'middle' },
  { key: 'passby', icon: 'bell', title: '머리 위를 지나면 알림', body: '잡거나, 엿보거나, 경로를 바꾸거나. 방어권은 내 편지를 지켜요.', cta: '다음', anchor: 'middle' },
  { key: 'stories', icon: 'image', title: '나라별 스토리', body: '어딘가에서 올라온 엽서. 탭해야 어느 나라인지 알 수 있어요.', cta: '다음', anchor: 'top' },
  { key: 'community', icon: 'compass', title: '커뮤니티', body: '거리만 보이는 사람들. 마음에 들면 편지를 보내요.', cta: '다음', anchor: 'bottom' },
  { key: 'compose', icon: 'send', title: '첫 편지는 걸어서 가요', body: '친구가 늘면 새·차·비행기로 빨라져요. 지금 써볼까요?', cta: '편지 쓰기', anchor: 'bottom' },
];

export function Tour({ onCompose }: { onCompose: () => void }) {
  const c = useColors();
  const { height } = useWindowDimensions();
  const setTourDone = useStore((s) => s.setTourDone);
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const native = Platform.OS !== 'web';
  useEffect(() => {
    fade.setValue(0); slide.setValue(16);
    Animated.parallel([Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: native }), Animated.timing(slide, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: native })]).start();
    track('tour_step', { step: STEPS[i].key, index: i });
  }, [i, fade, slide, native]);
  const step = STEPS[i];
  const finish = (how: 'done' | 'skip' | 'compose') => { track('tour_end', { how, at: step.key }); setTourDone(); if (how === 'compose') onCompose(); };
  const top = step.anchor === 'top' ? 130 : step.anchor === 'middle' ? height * 0.42 : height - 300;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} onPress={() => setI((x) => Math.min(STEPS.length - 1, x + 1))} testID="tour:backdrop" />
      <Animated.View style={[styles.card, shadow.float, { backgroundColor: c.bg, top, opacity: fade, transform: [{ translateY: slide }] }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}><View style={[styles.ic, { backgroundColor: c.blueSoft }]}><Icon name={step.icon} size={18} color={c.blue} /></View><T t="bodyStrong">{step.title}</T></Row>
          <T t="caption" color={c.text3}>{i + 1}/{STEPS.length}</T>
        </Row>
        <T t="small" color={c.text2} style={{ marginTop: 8 }}>{step.body}</T>
        <Row style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <Pressable onPress={() => finish('skip')} hitSlop={8} testID="btn:tour:skip"><T t="small" color={c.text3}>건너뛰기</T></Pressable>
          <Row gap={6}>
            {STEPS.map((s, k) => <View key={s.key} style={{ width: k === i ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? c.blue : c.line }} />)}
          </Row>
          <Button title={step.cta} size="sm" track={`tour:${step.key}`} onPress={() => (i === STEPS.length - 1 ? finish('compose') : setI(i + 1))} />
        </Row>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: spacing.lg, right: spacing.lg, borderRadius: radius.lg, padding: spacing.lg },
  ic: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
