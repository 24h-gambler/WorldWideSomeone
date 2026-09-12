/**
 * v2 UI 키트 — Instagram 문법: 얇은 구분선, 블루 CTA, 회색 보조 버튼, 스토리 링, 밑줄 탭, 리스트 행
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamily, gradients, radius, shadow, spacing, type, wordmarkFont } from '@/theme';
import { tap } from '@/engine/haptics';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];

// ---------- Text ----------
type TType = keyof typeof type;
export function T({ t = 'body', color = colors.text, style, children, ...rest }: TextProps & { t?: TType; color?: string; children?: React.ReactNode }) {
  return (
    <Text {...rest} style={[{ fontFamily, color }, type[t], style]}>
      {children}
    </Text>
  );
}

export function Wordmark({ size = 30, color = colors.text }: { size?: number; color?: string }) {
  return <Text style={{ fontFamily: wordmarkFont, fontSize: size, lineHeight: size * 1.2, color }}>WorldWideSomeone</Text>;
}

export function Icon({ name, size = 24, color = colors.text, style }: { name: FeatherName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return <Feather name={name} size={size} color={color} style={style as any} />;
}

// ---------- Screen / Header ----------
export function Screen({ children, style, padded = false, bg = colors.bg }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; bg?: string }) {
  const insets = useSafeAreaInsets();
  return <View style={[{ flex: 1, backgroundColor: bg, paddingTop: insets.top }, padded && { paddingHorizontal: spacing.lg }, style]}>{children}</View>;
}

/** Instagram 스타일 상단 바: 뒤로 ‹  제목(가운데/왼쪽)  오른쪽 액션 */
export function Header({ title, subtitle, right, left, back = true, onBack, center = false, wordmark = false, divider = true }: { title?: string; subtitle?: string; right?: React.ReactNode; left?: React.ReactNode; back?: boolean; onBack?: () => void; center?: boolean; wordmark?: boolean; divider?: boolean }) {
  const router = useRouter();
  return (
    <View style={[styles.header, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}>
      <View style={{ width: back || left ? undefined : 0, minWidth: 0, marginRight: left ? 12 : 0 }}>
        {left ? left : back ? (
          <Pressable
            hitSlop={12}
            onPress={() => {
              tap();
              if (onBack) onBack();
              else if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={{ paddingRight: 12, paddingVertical: 6 }}>
            <Icon name="chevron-left" size={28} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
        {wordmark ? <Wordmark /> : title ? <T t="h2" numberOfLines={1}>{title}</T> : null}
        {subtitle ? <T t="small" color={colors.text2} numberOfLines={1}>{subtitle}</T> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>{right}</View>
    </View>
  );
}

// ---------- Button ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'dark';
export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon, style, full }: { title: string; onPress?: () => void; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; loading?: boolean; icon?: FeatherName | string; style?: StyleProp<ViewStyle>; full?: boolean }) {
  const h = size === 'lg' ? 50 : size === 'sm' ? 32 : 44;
  const fs = size === 'lg' ? 15 : size === 'sm' ? 13 : 14;
  const bg = variant === 'primary' ? colors.blue : variant === 'secondary' ? colors.bg3 : variant === 'danger' ? colors.redSoft : variant === 'dark' ? colors.text : 'transparent';
  const fg = variant === 'primary' || variant === 'gradient' || variant === 'dark' ? '#fff' : variant === 'danger' ? colors.red : colors.text;
  const isFeather = typeof icon === 'string' && /^[a-z0-9-]+$/.test(icon);
  const inner = (
    <View style={[styles.btnInner, { height: h, paddingHorizontal: size === 'sm' ? 12 : 18 }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? (isFeather ? <Icon name={icon as FeatherName} size={fs + 3} color={fg} style={{ marginRight: 6 }} /> : <T style={{ fontSize: fs + 2, marginRight: 6 }}>{icon}</T>) : null}
          <T style={{ fontSize: fs, fontWeight: '600', color: fg }}>{title}</T>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [{ borderRadius: radius.sm, overflow: 'hidden', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, full && { alignSelf: 'stretch' }, variant === 'ghost' && { borderWidth: 1, borderColor: colors.line }, style]}>
      {variant === 'gradient' ? (
        <LinearGradient colors={[...gradients.ig3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{inner}</LinearGradient>
      ) : (
        <View style={{ backgroundColor: bg }}>{inner}</View>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, badge, size = 24, color = colors.text }: { name: FeatherName; onPress?: () => void; badge?: number; size?: number; color?: string }) {
  return (
    <Pressable hitSlop={8} onPress={() => { tap(); onPress?.(); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color={color} />
      {badge ? <Badge count={badge} /> : null}
    </Pressable>
  );
}

// ---------- Avatar / Story ring ----------
export function Avatar({ emoji, size = 44, anonymous, ring = 'none', bg = '#F1F5FF' }: { emoji?: string; size?: number; anonymous?: boolean; ring?: 'none' | 'ig' | 'blue' | 'gray'; bg?: string }) {
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: anonymous ? '#EFEFEF' : bg, alignItems: 'center', justifyContent: 'center', borderWidth: ring === 'none' ? 0 : 2, borderColor: '#fff' }}>
      {anonymous ? <T style={{ fontSize: size * 0.42, fontWeight: '700', color: colors.text2 }}>?</T> : <T style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji ?? '🙂'}</T>}
    </View>
  );
  if (ring === 'none') return inner;
  const pad = 2.5;
  const outer = size + pad * 2 + 4;
  if (ring === 'ig') {
    return (
      <LinearGradient colors={[...gradients.ig]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: outer, height: outer, borderRadius: outer, alignItems: 'center', justifyContent: 'center' }}>
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View style={{ width: outer, height: outer, borderRadius: outer, alignItems: 'center', justifyContent: 'center', backgroundColor: ring === 'blue' ? colors.blue : colors.line }}>
      {inner}
    </View>
  );
}

/** 스토리 행의 한 칸 */
export function StoryItem({ label, children, onPress, sub }: { label: string; children: React.ReactNode; onPress?: () => void; sub?: string }) {
  return (
    <Pressable onPress={onPress ? () => { tap(); onPress(); } : undefined} style={{ alignItems: 'center', width: 74, gap: 4 }}>
      {children}
      <T t="caption" numberOfLines={1} style={{ maxWidth: 72 }}>{label}</T>
      {sub ? <T t="caption" color={colors.text3} numberOfLines={1} style={{ marginTop: -3 }}>{sub}</T> : null}
    </Pressable>
  );
}

// ---------- Tabs (밑줄) ----------
export function UnderlineTabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; icon?: FeatherName }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }}>
      {tabs.map((tb) => {
        const on = tb.key === value;
        return (
          <Pressable key={tb.key} onPress={() => { tap(); onChange(tb.key); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: on ? colors.text : 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {tb.icon ? <Icon name={tb.icon} size={16} color={on ? colors.text : colors.text3} /> : null}
            <T t="bodyStrong" color={on ? colors.text : colors.text3}>{tb.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Chip (필터) ----------
export function Chip({ label, selected, onPress, small, icon, color = colors.text }: { label: string; selected?: boolean; onPress?: () => void; small?: boolean; icon?: string; color?: string }) {
  return (
    <Pressable onPress={onPress ? () => { tap(); onPress(); } : undefined} style={[styles.chip, small && { paddingVertical: 5, paddingHorizontal: 10 }, selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: colors.bg, borderColor: colors.line }]}>
      {icon ? <T style={{ fontSize: small ? 12 : 14, marginRight: 4 }}>{icon}</T> : null}
      <T t={small ? 'smallStrong' : 'bodyStrong'} color={selected ? '#fff' : colors.text}>{label}</T>
    </Pressable>
  );
}

// ---------- Card / Row / Section ----------
export function Card({ children, style, onPress, flat }: ViewProps & { onPress?: () => void; flat?: boolean }) {
  const body = <View style={[styles.card, !flat && shadow.card, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

export function ListRow({ left, title, subtitle, right, onPress, divider = true }: { left?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; divider?: boolean }) {
  const body = (
    <View style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft }]}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? <T t="bodyStrong" numberOfLines={1}>{title}</T> : title}
        {typeof subtitle === 'string' ? <T t="small" color={colors.text2} numberOfLines={2}>{subtitle}</T> : subtitle}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ backgroundColor: pressed ? colors.bg2 : 'transparent' })}>
      {body}
    </Pressable>
  );
}

export function Section({ title, right, children, style, action }: { title: string; right?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle>; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={[{ marginTop: spacing.xl }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, paddingHorizontal: spacing.lg }}>
        <T t="h2">{title}</T>
        {right}
        {action ? <Pressable onPress={() => { tap(); action.onPress(); }}><T t="bodyStrong" color={colors.blue}>{action.label}</T></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

export function Empty({ icon, emoji, title, body, action }: { icon?: FeatherName; emoji?: string; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: 8, paddingHorizontal: spacing.xl }}>
      {icon ? <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={30} /></View> : <T style={{ fontSize: 40 }}>{emoji}</T>}
      <T t="title" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T t="body" color={colors.text2} style={{ textAlign: 'center' }}>{body}</T> : null}
      {action}
    </View>
  );
}

export function Badge({ count, color = colors.red }: { count: number; color?: string }) {
  if (!count) return null;
  return (
    <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' }}>
      <T style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count > 99 ? '99+' : count}</T>
    </View>
  );
}

export function Row({ children, style, gap = spacing.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Coin({ amount, onPress }: { amount: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ? () => { tap(); onPress(); } : undefined} style={styles.coin}>
      <T style={{ fontSize: 12 }}>🪙</T>
      <T t="smallStrong">{amount.toLocaleString('ko-KR')}</T>
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: inset }} />;
}

export function ProgressBar({ value, color = colors.blue, height = 4, track = colors.bg3 }: { value: number; color?: string; height?: number; track?: string }) {
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(1.5, Math.min(100, value * 100))}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Pill({ label, color = colors.bg3, textColor = colors.text, icon }: { label: string; color?: string; textColor?: string; icon?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color, paddingHorizontal: 8, height: 22, borderRadius: 11 }}>
      {icon ? <T style={{ fontSize: 11 }}>{icon}</T> : null}
      <T t="caption" color={textColor} style={{ fontWeight: '600' }}>{label}</T>
    </View>
  );
}

/** 하단 시트 느낌의 패널 (모달 대신 화면 하단 고정) */
export function Sheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, shadow.float, { paddingBottom: Math.max(insets.bottom, 12) + 8 }, style]}>
      <View style={styles.grabber} />
      {children}
    </View>
  );
}

export function HScroll({ children, style, contentStyle }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0, flexShrink: 0 }, style]} contentContainerStyle={[{ paddingHorizontal: spacing.lg, gap: 10, alignItems: 'center' }, contentStyle]}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 52, backgroundColor: colors.bg },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  card: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: 'transparent' },
  coin: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg3, paddingHorizontal: 10, height: 28, borderRadius: 14 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spacing.lg, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
});
