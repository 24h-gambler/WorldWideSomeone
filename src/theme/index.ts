/**
 * 디자인 토큰 v3 — 라이트/다크 팔레트 + 훅.
 * 라이트: Instagram 화이트. 다크: Instagram 다크(#000 배경, #FAFAFA 텍스트). 지구는 Zenly 파스텔 / 다크는 깊은 밤바다.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';

export const palettes = {
  light: {
    scheme: 'light' as const,
    bg: '#FFFFFF', bg2: '#FAFAFA', bg3: '#F2F2F2', line: '#DBDBDB', lineSoft: '#EFEFEF',
    text: '#262626', text2: '#737373', text3: '#A8A8A8', onDark: '#FFFFFF',
    blue: '#0095F6', blueSoft: '#E7F3FF', red: '#ED4956', redSoft: '#FDECEE', green: '#2DBE60', greenSoft: '#E6F8ED',
    yellow: '#FFB800', yellowSoft: '#FFF6DB', yellowText: '#8A6D00', purple: '#8134AF', purpleSoft: '#F3E8FF', pink: '#D62976', orange: '#FA7E1E',
    paper: '#FBF4E4', paperLine: '#EEDFC0', paperText: '#2A2418', paperMuted: '#8A7A5A', stampBg: '#F4EAD3', stampLine: '#D9C9A6',
    bubbleMe: ['#5851DB', '#833AB4', '#E1306C'] as readonly string[], bubbleThem: '#EFEFEF',
    // 지구
    sky: ['#F4FAFF', '#DDEEFF'] as readonly string[], ocean: '#BFE3FF', oceanDeep: '#86C6FF', oceanLight: '#E3F4FF', land: '#C9F0BC', landDark: '#9BE0A4', landLine: 'rgba(90,170,110,0.35)',
    graticule: 'rgba(80,140,220,0.10)', halo: '#7DBBFF', rim: '#1B5FBF', bubble: '#FFFFFF', bubbleShadow: '#0B3D91',
  },
  dark: {
    scheme: 'dark' as const,
    bg: '#000000', bg2: '#121212', bg3: '#262626', line: '#363636', lineSoft: '#262626',
    text: '#FAFAFA', text2: '#A8A8A8', text3: '#737373', onDark: '#FFFFFF',
    blue: '#0095F6', blueSoft: '#0B2A44', red: '#ED4956', redSoft: '#3A1A1E', green: '#2DBE60', greenSoft: '#12301C',
    yellow: '#FFB800', yellowSoft: '#3A2F0A', yellowText: '#FFD166', purple: '#B57BFF', purpleSoft: '#2A1A3A', pink: '#E1306C', orange: '#FA7E1E',
    paper: '#2A2418', paperLine: '#3F3626', paperText: '#F3EAD4', paperMuted: '#B8A98A', stampBg: '#3A3120', stampLine: '#6A5A3A',
    bubbleMe: ['#5851DB', '#833AB4', '#E1306C'] as readonly string[], bubbleThem: '#262626',
    sky: ['#0A1424', '#0E1E36'] as readonly string[], ocean: '#173A66', oceanDeep: '#0D2242', oceanLight: '#2A5A94', land: '#3E7A57', landDark: '#2F6446', landLine: 'rgba(120,200,150,0.25)',
    graticule: 'rgba(140,180,240,0.10)', halo: '#3A7BD5', rim: '#020814', bubble: '#1C1C1E', bubbleShadow: '#000000',
  },
};
export type ThemeColors = typeof palettes.light | typeof palettes.dark;

/** 정적 기본값(라이트). 컴포넌트 안에서는 useColors() 를 쓴다. */
export const colors = palettes.light;

const ThemeCtx = createContext<ThemeColors>(palettes.light);
export function ThemeProvider({ mode, children }: { mode: 'system' | 'light' | 'dark'; children: React.ReactNode }) {
  const sys = useColorScheme();
  const scheme = mode === 'system' ? (sys === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(() => palettes[scheme], [scheme]);
  return React.createElement(ThemeCtx.Provider, { value }, children);
}
export const useColors = () => useContext(ThemeCtx);
export function useStyles<T>(make: (c: ThemeColors) => T): T {
  const c = useColors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => make(c), [c]);
}

export const gradients = {
  ig: ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'] as const,
  ig3: ['#F58529', '#DD2A7B', '#8134AF'] as const,
  dm: ['#5851DB', '#833AB4', '#E1306C'] as const,
  blue: ['#1FA1FF', '#0095F6'] as const,
  sunset: ['#FA7E1E', '#D62976'] as const,
  gold: ['#FFD86B', '#FFB800'] as const,
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' });
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
