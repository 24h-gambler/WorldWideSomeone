/**
 * WorldWideSomeone 디자인 토큰 — "밤의 지구" 다크 테마.
 * Zenly의 장난스러운 채도 + Instagram 그라데이션 + Stripe/GitHub 지구의 아크 감성.
 */
import { Platform } from 'react-native';

export const colors = {
  bg: '#070B1A',
  bgElevated: '#0D1330',
  card: 'rgba(255,255,255,0.06)',
  cardStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.18)',

  text: '#F4F6FF',
  textDim: '#A3ABCF',
  textFaint: '#5F6890',

  primary: '#7C5CFF',
  accent: '#FF5C8A',
  warm: '#FFA94D',
  mint: '#4FE3C1',
  sky: '#5AB8FF',
  gold: '#FFD166',

  danger: '#FF5D6C',
  success: '#3DDC97',

  ocean: '#0C1F4F',
  oceanDeep: '#061238',
  land: '#1E9E86',
  landDark: '#137763',
  atmosphere: '#5A8CFF',
} as const;

export const gradients = {
  insta: ['#FF5C8A', '#FF9A5C', '#7C5CFF'] as const,
  sunset: ['#FF9A5C', '#FF5C8A'] as const,
  purple: ['#7C5CFF', '#5AB8FF'] as const,
  mint: ['#4FE3C1', '#5AB8FF'] as const,
  gold: ['#FFD166', '#FFA94D'] as const,
  card: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default:
    'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, sans-serif',
});

export const type = {
  hero: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8, lineHeight: 38 },
  title: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.2 },
} as const;

export const shadow = {
  glow: (color: string, r = 18) => ({
    shadowColor: color,
    shadowOpacity: 0.55,
    shadowRadius: r,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  }),
};

export const TAB_BAR_HEIGHT = 64;
