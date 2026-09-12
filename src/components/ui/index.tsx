import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamily, gradients, radius, spacing, type } from '@/theme';
import { tap } from '@/engine/haptics';

// ---------- Text ----------
type TType = keyof typeof type;
export function T({
  t = 'body',
  color = colors.text,
  style,
  children,
  ...rest
}: TextProps & { t?: TType; color?: string; children?: React.ReactNode }) {
  return (
    <Text {...rest} style={[{ fontFamily, color }, type[t], style]}>
      {children}
    </Text>
  );
}

export function GradientText({ children, colorsArr = gradients.insta, style }: { children: string; colorsArr?: readonly string[]; style?: StyleProp<TextStyle> }) {
  // 웹/네이티브 공통 단순 구현: 첫 색으로 대체 + 그라데이션 언더라인 느낌은 생략
  return <T t="hero" style={[{ color: colorsArr[0] }, style]}>{children}</T>;
}

// ---------- Screen / Header ----------
export function Screen({ children, style, padded = true, scrollable = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; scrollable?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }, padded && { paddingHorizontal: spacing.lg }, style]}>
      {children}
    </View>
  );
}

export function Header({ title, subtitle, right, back = true, onBack }: { title?: string; subtitle?: string; right?: React.ReactNode; back?: boolean; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          hitSlop={10}
          onPress={() => {
            tap();
            if (onBack) onBack();
            else if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          style={styles.backBtn}>
          <T t="h2" color={colors.text}>‹</T>
        </Pressable>
      ) : (
        <View style={{ width: 8 }} />
      )}
      <View style={{ flex: 1 }}>
        {title ? <T t="h2">{title}</T> : null}
        {subtitle ? <T t="small" color={colors.textDim}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

// ---------- Button ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'mint' | 'paper';
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
  full,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}) {
  const h = size === 'lg' ? 56 : size === 'sm' ? 38 : 48;
  const fs = size === 'lg' ? 17 : size === 'sm' ? 13 : 15;
  const grad =
    variant === 'primary' ? gradients.insta : variant === 'gold' ? gradients.gold : variant === 'mint' ? gradients.mint : null;
  const bg =
    variant === 'secondary' ? colors.cardStrong : variant === 'ghost' ? 'transparent' : variant === 'danger' ? 'rgba(255,93,108,0.18)' : variant === 'paper' ? '#EADFC7' : 'transparent';
  const fg = variant === 'danger' ? colors.danger : variant === 'gold' || variant === 'mint' || variant === 'paper' ? '#2A2418' : colors.text;
  const inner = (
    <View style={[styles.btnInner, { height: h, paddingHorizontal: size === 'sm' ? 14 : 20 }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <T style={{ fontSize: fs + 2, marginRight: 6 }}>{icon}</T> : null}
          <T style={{ fontSize: fs, fontWeight: '700', color: fg }}>{title}</T>
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
      style={({ pressed }) => [
        { borderRadius: radius.pill, overflow: 'hidden', opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        full && { alignSelf: 'stretch' },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.borderStrong },
        style,
      ]}>
      {grad ? (
        <LinearGradient colors={[...grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={{ backgroundColor: bg }}>{inner}</View>
      )}
    </Pressable>
  );
}

// ---------- Card ----------
export function Card({ children, style, onPress, glow }: ViewProps & { onPress?: () => void; glow?: string }) {
  const body = (
    <View style={[styles.card, glow && { borderColor: glow, shadowColor: glow, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

// ---------- Chip ----------
export function Chip({ label, selected, onPress, color = colors.primary, small, icon }: { label: string; selected?: boolean; onPress?: () => void; color?: string; small?: boolean; icon?: string }) {
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      style={[
        styles.chip,
        small && { paddingVertical: 4, paddingHorizontal: 10 },
        selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: colors.card, borderColor: colors.border },
      ]}>
      {icon ? <T style={{ fontSize: small ? 12 : 14, marginRight: 4 }}>{icon}</T> : null}
      <T t={small ? 'caption' : 'small'} color={selected ? '#fff' : colors.textDim} style={{ fontWeight: '700' }}>
        {label}
      </T>
    </Pressable>
  );
}

// ---------- Avatar ----------
export function Avatar({ emoji, size = 44, anonymous, ring = true }: { emoji?: string; size?: number; anonymous?: boolean; ring?: boolean }) {
  const inner = (
    <View style={{ width: size - 6, height: size - 6, borderRadius: size, backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontSize: size * 0.48, lineHeight: size * 0.6 }}>{anonymous ? '?' : emoji ?? '🙂'}</T>
    </View>
  );
  if (!ring) return inner;
  return (
    <LinearGradient colors={anonymous ? ['#5F6890', '#2C3358'] : [...gradients.insta]} style={{ width: size, height: size, borderRadius: size, alignItems: 'center', justifyContent: 'center' }}>
      {inner}
    </LinearGradient>
  );
}

// ---------- Progress ----------
export function ProgressBar({ value, color = colors.accent, height = 6, track = colors.card }: { value: number; color?: string; height?: number; track?: string }) {
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

// ---------- Section ----------
export function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: spacing.xl }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <T t="h2">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Empty({ emoji, title, body }: { emoji: string; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: 6 }}>
      <T style={{ fontSize: 40 }}>{emoji}</T>
      <T t="bodyStrong">{title}</T>
      {body ? <T t="small" color={colors.textDim} style={{ textAlign: 'center' }}>{body}</T> : null}
    </View>
  );
}

export function Badge({ count, color = colors.accent }: { count: number; color?: string }) {
  if (!count) return null;
  return (
    <View style={{ position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
      <T t="caption" style={{ color: '#fff', fontSize: 10 }}>{count > 99 ? '99+' : count}</T>
    </View>
  );
}

export function Row({ children, style, gap = spacing.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Coin({ amount }: { amount: number }) {
  return (
    <View style={styles.coin}>
      <T style={{ fontSize: 13 }}>🪙</T>
      <T t="small" style={{ fontWeight: '800', color: colors.gold }}>{amount.toLocaleString('ko-KR')}</T>
    </View>
  );
}

export function IconButton({ icon, onPress, badge, size = 40 }: { icon: string; onPress?: () => void; badge?: number; size?: number }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.iconBtn, { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.7 : 1 }]}>
      <T style={{ fontSize: size * 0.45 }}>{icon}</T>
      {badge ? <Badge count={badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, minHeight: 56 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  coin: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, paddingHorizontal: 10, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  iconBtn: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
