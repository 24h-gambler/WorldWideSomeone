/**
 * WorldWideSomeone v2 디자인 토큰
 * - 베이스: Instagram (화이트 배경, #262626 텍스트, #DBDBDB 구분선, #0095F6 블루, 스토리 링 그라데이션)
 * - 지구: Zenly (밝은 하늘색 바다, 파스텔 민트 육지, 흰 테두리 아바타 버블, 진한 그림자)
 */
import { Platform } from 'react-native';

export const colors = {
  bg: '#FFFFFF',
  bg2: '#FAFAFA',
  bg3: '#F2F2F2',
  line: '#DBDBDB',
  lineSoft: '#EFEFEF',

  text: '#262626',
  text2: '#737373',
  text3: '#A8A8A8',
  onDark: '#FFFFFF',

  blue: '#0095F6',
  blueSoft: '#E7F3FF',
  red: '#ED4956',
  redSoft: '#FDECEE',
  green: '#2DBE60',
  greenSoft: '#E6F8ED',
  yellow: '#FFB800',
  yellowSoft: '#FFF6DB',
  purple: '#8134AF',
  pink: '#D62976',
  orange: '#FA7E1E',

  // Zenly 지구
  sky: '#EAF6FF',
  skyDeep: '#D6ECFF',
  ocean: '#BFE3FF',
  oceanDeep: '#86C6FF',
  land: '#BFEFB0',
  landDark: '#8ADB97',
  landLine: '#6CC985',
  graticule: 'rgba(80,140,220,0.12)',
} as const;

export const gradients = {
  /** Instagram 스토리 링 */
  ig: ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'] as const,
  ig3: ['#F58529', '#DD2A7B', '#8134AF'] as const,
  /** Instagram DM 내 말풍선 */
  dm: ['#5851DB', '#833AB4', '#E1306C'] as const,
  blue: ['#1FA1FF', '#0095F6'] as const,
  sunset: ['#FA7E1E', '#D62976'] as const,
  gold: ['#FFD86B', '#FFB800'] as const,
  sky: ['#F7FBFF', '#EAF6FF'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});
export const wordmarkFont = 'GrandHotel_400Regular';

export const type = {
  wordmark: { fontSize: 30, lineHeight: 36 },
  hero: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.6, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 28 },
  h2: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  smallStrong: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },
} as const;

export const shadow = {
  bubble: { shadowColor: '#0B3D91', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  card: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  float: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
};

export const TAB_BAR_HEIGHT = 50;
