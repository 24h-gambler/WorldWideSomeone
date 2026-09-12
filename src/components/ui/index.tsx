/** v3 UI 키트 — 모든 컴포넌트가 useColors() 로 라이트/다크 팔레트를 읽는다. */
import React from 'react';
import { ItemIcon } from '../item-art';
import { trackTap, trackScroll } from '@/services/analytics';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextProps, View, ViewProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily, gradients, radius, shadow, spacing, type, useColors, wordmarkFont } from '@/theme';
import { tap } from '@/engine/haptics';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];
type TType = keyof typeof type;

export function T({ t = 'body', color, style, children, ...rest }: TextProps & { t?: TType; color?: string; children?: React.ReactNode }) {
  const c = useColors();
  return <Text {...rest} style={[{ fontFamily, color: color ?? c.text }, type[t], style]}>{children}</Text>;
}
export function Wordmark({ size = 30, color }: { size?: number; color?: string }) {
  const c = useColors();
  return <Text style={{ fontFamily: wordmarkFont, fontSize: size, lineHeight: size * 1.2, color: color ?? c.text }}>WorldWideSomeone</Text>;
}
export function Icon({ name, size = 24, color, style }: { name: FeatherName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <Feather name={name} size={size} color={color ?? c.text} style={style as any} />;
}
export function Screen({ children, style, padded = false, bg }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; bg?: string }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return <View style={[{ flex: 1, backgroundColor: bg ?? c.bg, paddingTop: insets.top }, padded && { paddingHorizontal: spacing.lg }, style]}>{children}</View>;
}
export function Header({ title, subtitle, right, left, back = true, onBack, center = false, wordmark = false, divider = true }: { title?: string; subtitle?: string; right?: React.ReactNode; left?: React.ReactNode; back?: boolean; onBack?: () => void; center?: boolean; wordmark?: boolean; divider?: boolean }) {
  const router = useRouter();
  const c = useColors();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 52, backgroundColor: c.bg }, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
      <View style={{ width: back || left ? undefined : 0, minWidth: 0, marginRight: left ? 12 : 0 }}>
        {left ? left : back ? (
          <Pressable hitSlop={12} onPress={() => { tap(); if (onBack) onBack(); else if (router.canGoBack()) router.back(); else router.replace('/'); }} style={{ paddingRight: 12, paddingVertical: 6 }}><Icon name="chevron-left" size={28} /></Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        {wordmark ? <Wordmark /> : title ? <T t="h2" numberOfLines={1}>{title}</T> : null}
        {subtitle ? <T t="small" color={c.text2} numberOfLines={1}>{subtitle}</T> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>{right}</View>
    </View>
  );
}
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'dark';
export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon, style, full, track }: { title: string; onPress?: () => void; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; loading?: boolean; icon?: FeatherName | string; style?: StyleProp<ViewStyle>; track?: string; full?: boolean }) {
  const c = useColors();
  const h = size === 'lg' ? 50 : size === 'sm' ? 32 : 44;
  const fs = size === 'lg' ? 15 : size === 'sm' ? 13 : 14;
  const bg = variant === 'primary' ? c.blue : variant === 'secondary' ? c.bg3 : variant === 'danger' ? c.redSoft : variant === 'dark' ? c.text : 'transparent';
  const fg = variant === 'primary' || variant === 'gradient' ? '#fff' : variant === 'dark' ? c.bg : variant === 'danger' ? c.red : c.text;
  const isFeather = typeof icon === 'string' && /^[a-z0-9-]+$/.test(icon);
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: h, paddingHorizontal: size === 'sm' ? 12 : 18 }}>
      {loading ? <ActivityIndicator color={fg} /> : (<>{icon ? (isFeather ? <Icon name={icon as FeatherName} size={fs + 3} color={fg} style={{ marginRight: 6 }} /> : <T style={{ fontSize: fs + 2, marginRight: 6 }}>{icon}</T>) : null}<T style={{ fontSize: fs, fontWeight: '600', color: fg }}>{title}</T></>)}
    </View>
  );
  return (
    <Pressable disabled={disabled || loading} testID={`btn:${track ?? title}`} accessibilityRole="button" accessibilityLabel={title} onPress={() => { tap(); trackTap(track ?? `btn:${title}`); onPress?.(); }} style={({ pressed }) => [{ borderRadius: radius.sm, overflow: 'hidden', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, full && { alignSelf: 'stretch' }, variant === 'ghost' && { borderWidth: 1, borderColor: c.line }, style]}>
      {variant === 'gradient' ? <LinearGradient colors={[...gradients.ig3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{inner}</LinearGradient> : <View style={{ backgroundColor: bg }}>{inner}</View>}
    </Pressable>
  );
}
export function IconButton({ name, onPress, badge, size = 24, color, label, track }: { name: FeatherName; onPress?: () => void; badge?: number; size?: number; color?: string; label?: string; track?: string }) {
  return (
    <Pressable hitSlop={8} testID={`icon:${track ?? label ?? name}`} accessibilityLabel={label} accessibilityRole="button" onPress={() => { tap(); trackTap(track ?? `icon:${label ?? name}`); onPress?.(); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color={color} />
      {badge ? <Badge count={badge} /> : null}
    </Pressable>
  );
}
export function Avatar({ emoji, size = 44, anonymous, ring = 'none', bg }: { emoji?: string; size?: number; anonymous?: boolean; ring?: 'none' | 'ig' | 'blue' | 'gray'; bg?: string }) {
  const c = useColors();
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: anonymous ? c.bg3 : bg ?? c.blueSoft, alignItems: 'center', justifyContent: 'center', borderWidth: ring === 'none' ? 0 : 2, borderColor: c.bg }}>
      {anonymous ? <T style={{ fontSize: size * 0.42, fontWeight: '700', color: c.text2 }}>?</T> : <T style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji ?? '🙂'}</T>}
    </View>
  );
  if (ring === 'none') return inner;
  const outer = size + 9;
  if (ring === 'ig') return <LinearGradient colors={[...gradients.ig]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: outer, height: outer, borderRadius: outer, alignItems: 'center', justifyContent: 'center' }}>{inner}</LinearGradient>;
  return <View style={{ width: outer, height: outer, borderRadius: outer, alignItems: 'center', justifyContent: 'center', backgroundColor: ring === 'blue' ? c.blue : c.line }}>{inner}</View>;
}
export function StoryItem({ label, children, onPress, sub, track }: { label: string; children: React.ReactNode; onPress?: () => void; sub?: string; track?: string }) {
  const c = useColors();
  return (
    <Pressable testID={`story:${track ?? label}`} onPress={onPress ? () => { tap(); trackTap(track ?? `story:${label}`); onPress(); } : undefined} style={{ alignItems: 'center', width: 74, gap: 4 }}>
      {children}
      <T t="caption" numberOfLines={1} style={{ maxWidth: 72 }}>{label}</T>
      {sub ? <T t="caption" color={c.text3} numberOfLines={1} style={{ marginTop: -3 }}>{sub}</T> : null}
    </Pressable>
  );
}
export function UnderlineTabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; icon?: FeatherName }[]; value: K; onChange: (k: K) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
      {tabs.map((tb) => { const on = tb.key === value; return (
        <Pressable key={tb.key} onPress={() => { tap(); onChange(tb.key); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: on ? c.text : 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {tb.icon ? <Icon name={tb.icon} size={16} color={on ? c.text : c.text3} /> : null}
          <T t="bodyStrong" color={on ? c.text : c.text3}>{tb.label}</T>
        </Pressable>
      ); })}
    </View>
  );
}
export function Chip({ label, selected, onPress, small, icon, color, track }: { label: string; selected?: boolean; onPress?: () => void; small?: boolean; icon?: string; color?: string; track?: string }) {
  const c = useColors();
  const col = color ?? c.text;
  return (
    <Pressable testID={`chip:${track ?? label}`} onPress={onPress ? () => { tap(); trackTap(track ?? `chip:${label}`, { selected: !selected }); onPress(); } : undefined} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: small ? 5 : 7, paddingHorizontal: small ? 10 : 14, borderRadius: radius.pill, borderWidth: 1 }, selected ? { backgroundColor: col, borderColor: col } : { backgroundColor: c.bg, borderColor: c.line }]}>
      {icon ? <T style={{ fontSize: small ? 12 : 14, marginRight: 4 }}>{icon}</T> : null}
      <T t={small ? 'smallStrong' : 'bodyStrong'} color={selected ? (col === c.text ? c.bg : '#fff') : c.text}>{label}</T>
    </Pressable>
  );
}
export function Card({ children, style, onPress, flat }: ViewProps & { onPress?: () => void; flat?: boolean }) {
  const c = useColors();
  const body = <View style={[{ backgroundColor: c.bg, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }, !flat && shadow.card, style]}>{children}</View>;
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{body}</Pressable>;
}
export function ListRow({ left, title, subtitle, right, onPress, divider = true, track }: { left?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; divider?: boolean; track?: string }) {
  const c = useColors();
  const body = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 10 }, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.lineSoft }]}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>{typeof title === 'string' ? <T t="bodyStrong" numberOfLines={1}>{title}</T> : title}{typeof subtitle === 'string' ? <T t="small" color={c.text2} numberOfLines={2}>{subtitle}</T> : subtitle}</View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return <Pressable testID={`row:${track ?? (typeof title === 'string' ? title : 'row')}`} onPress={() => { tap(); trackTap(track ?? `row:${typeof title === 'string' ? title : 'row'}`); onPress(); }} style={({ pressed }) => ({ backgroundColor: pressed ? c.bg2 : 'transparent' })}>{body}</Pressable>;
}
export function Section({ title, right, children, style, action }: { title: string; right?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle>; action?: { label: string; onPress: () => void } }) {
  const c = useColors();
  return (
    <View style={[{ marginTop: spacing.xl }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, paddingHorizontal: spacing.lg }}>
        <T t="h2">{title}</T>{right}{action ? <Pressable onPress={() => { tap(); action.onPress(); }}><T t="bodyStrong" color={c.blue}>{action.label}</T></Pressable> : null}
      </View>
      {children}
    </View>
  );
}
export function Empty({ icon, emoji, title, body, action }: { icon?: FeatherName; emoji?: string; title: string; body?: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: 8, paddingHorizontal: spacing.xl }}>
      {icon ? <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: c.text, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={30} /></View> : <T style={{ fontSize: 40 }}>{emoji}</T>}
      <T t="title" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T t="body" color={c.text2} style={{ textAlign: 'center' }}>{body}</T> : null}
      {action}
    </View>
  );
}
export function Badge({ count, color }: { count: number; color?: string }) {
  const c = useColors();
  if (!count) return null;
  return <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: color ?? c.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: c.bg }}><T style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count > 99 ? '99+' : count}</T></View>;
}
export function Row({ children, style, gap = spacing.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}
export function Coin({ amount, onPress }: { amount: number; onPress?: () => void }) {
  const c = useColors();
  return <Pressable onPress={onPress ? () => { tap(); onPress(); } : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg3, paddingHorizontal: 10, height: 28, borderRadius: 14 }}><ItemIcon id="coin" size={15} /><T t="smallStrong">{amount.toLocaleString('ko-KR')}</T><T t="caption" style={{ opacity: 0.7 }}>SC</T></Pressable>;
}
export function Divider({ inset = 0 }: { inset?: number }) { const c = useColors(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: inset }} />; }
export function ProgressBar({ value, color, height = 4, track }: { value: number; color?: string; height?: number; track?: string }) {
  const c = useColors();
  return <View style={{ height, backgroundColor: track ?? c.bg3, borderRadius: height, overflow: 'hidden' }}><View style={{ width: `${Math.max(1.5, Math.min(100, value * 100))}%`, height, backgroundColor: color ?? c.blue, borderRadius: height }} /></View>;
}
export function Pill({ label, color, textColor, icon }: { label: string; color?: string; textColor?: string; icon?: string | React.ReactNode }) {
  const c = useColors();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color ?? c.bg3, paddingHorizontal: 8, height: 22, borderRadius: 11 }}>{typeof icon === 'string' ? <T style={{ fontSize: 11 }}>{icon}</T> : icon ?? null}<T t="caption" color={textColor ?? c.text} style={{ fontWeight: '600' }}>{label}</T></View>;
}
export function HScroll({ children, style, contentStyle }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0, flexShrink: 0 }, style]} contentContainerStyle={[{ paddingHorizontal: spacing.lg, gap: 10, alignItems: 'center' }, contentStyle]}>{children}</ScrollView>;
}
/** 편지지 (크림 / 다크 크림) */
export function Paper({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.paper, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.paperLine }, style]}>{children}</View>;
}
export function Stamp({ flag, label }: { flag: string; label: string }) {
  const c = useColors();
  return <View style={{ width: 58, height: 62, borderWidth: 1.5, borderColor: c.stampLine, borderStyle: 'dashed', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: c.stampBg, transform: [{ rotate: '4deg' }] }}><T style={{ fontSize: 22 }}>{flag}</T><T t="caption" color={c.paperMuted}>{label}</T></View>;
}

/** 스크롤 깊이(25/50/75/100%) 트래킹 스크롤뷰 — 화면 단위 id */
export function TrackedScrollView({ id, children, onScroll, ...rest }: React.ComponentProps<typeof ScrollView> & { id: string }) {
  const sent = React.useRef<Set<number>>(new Set());
  const handle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    const depth = Math.min(100, Math.round((contentOffset.y / max) * 100));
    for (const m of [25, 50, 75, 100]) if (depth >= m && !sent.current.has(m)) { sent.current.add(m); trackScroll(id, m); }
    onScroll?.(e);
  };
  return <ScrollView scrollEventThrottle={250} onScroll={handle} {...rest}>{children}</ScrollView>;
}
