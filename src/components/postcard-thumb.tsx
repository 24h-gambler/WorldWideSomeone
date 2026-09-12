/**
 * 엽서 대표 이미지 (사진이 없을 때) — 국가를 드러내지 않는 풍경 일러스트 4종(바다·산·도시 야경·들판).
 * 같은 엽서는 항상 같은 그림(id 해시). 홈 스토리 원형 · 피드 카드 · 엽서 상세에 쓴다.
 */
import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
export type SceneKind = 'sea' | 'mountain' | 'city' | 'field';
export const sceneOf = (seed: string): SceneKind => (['sea', 'mountain', 'city', 'field'] as const)[hash(seed) % 4];

/** viewBox 160×120 */
export function PostcardThumb({ seed, width, height, radius = 0 }: { seed: string; width: number; height: number; radius?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const kind = sceneOf(seed);
  const h = hash(seed);
  const gid = `pc-sky-${uid}`;
  const sky = kind === 'sea' ? ['#7CC7FF', '#FFD6A5'] : kind === 'mountain' ? ['#5D5FEF', '#FF9DB5'] : kind === 'city' ? ['#0B1B3F', '#2F3E7A'] : ['#8ED8FF', '#EAF7FF'];
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" style={{ borderRadius: radius }}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={sky[0]} /><Stop offset="1" stopColor={sky[1]} /></LinearGradient>
        <LinearGradient id={`${gid}-sea`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#3FA9F5" /><Stop offset="1" stopColor="#1D6FC2" /></LinearGradient>
      </Defs>
      <Rect width={160} height={120} fill={`url(#${gid})`} />
      {kind === 'sea' && (<>
        <Circle cx={118} cy={38} r={16} fill="#FFE27A" />
        <Rect x={0} y={68} width={160} height={52} fill={`url(#${gid}-sea)`} />
        <Path d="M0 74 Q 12 68 24 74 T 48 74 T 72 74 T 96 74 T 120 74 T 144 74 T 168 74" stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.7} />
        <Path d="M0 90 Q 14 84 28 90 T 56 90 T 84 90 T 112 90 T 140 90 T 168 90" stroke="#FFFFFF" strokeWidth={1.5} fill="none" opacity={0.4} />
        <Path d="M20 70 Q 22 40 18 26" stroke="#3E2A1A" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M18 26 Q 4 22 2 30 M18 26 Q 30 16 40 24 M18 26 Q 26 10 34 8 M18 26 Q 8 10 4 12" stroke="#2E9E5B" strokeWidth={4} fill="none" strokeLinecap="round" />
        <Path d="M0 110 Q 40 100 80 108 T 160 104 V120 H0 Z" fill="#F7E3B5" />
      </>)}
      {kind === 'mountain' && (<>
        <Circle cx={34} cy={30} r={11} fill="#FFF3C4" opacity={0.95} />
        <Polygon points="0,120 40,44 80,120" fill="#3B3F8C" />
        <Polygon points="40,44 30,64 50,64" fill="#FFFFFF" opacity={0.85} />
        <Polygon points="50,120 104,30 158,120" fill="#2B2F6E" />
        <Polygon points="104,30 92,54 116,54" fill="#FFFFFF" opacity={0.9} />
        <Polygon points="120,120 150,70 180,120" fill="#3B3F8C" />
        <Rect x={0} y={100} width={160} height={20} fill="#1E2250" />
        <Polygon points="20,100 26,84 32,100" fill="#173A2A" /><Polygon points="60,100 66,86 72,100" fill="#173A2A" /><Polygon points="130,100 136,82 142,100" fill="#173A2A" />
      </>)}
      {kind === 'city' && (<>
        {Array.from({ length: 14 }).map((_, i) => <Circle key={i} cx={(i * 37 + h) % 160} cy={(i * 23 + h) % 50} r={i % 3 === 0 ? 1.6 : 1} fill="#FFFFFF" opacity={0.8} />)}
        <Circle cx={128} cy={26} r={12} fill="#FFF6D6" /><Circle cx={122} cy={22} r={10} fill="#1A2A5C" opacity={0.95} />
        {[0, 22, 40, 62, 84, 100, 122, 140].map((x, i) => { const bh = 40 + ((h >> i) % 40); const bw = i % 2 ? 16 : 22; return (
          <React.Fragment key={x}>
            <Rect x={x} y={120 - bh} width={bw} height={bh} fill={i % 3 === 0 ? '#101A3A' : '#182452'} />
            {Array.from({ length: Math.floor(bh / 9) }).map((__, r) => Array.from({ length: bw > 18 ? 3 : 2 }).map((___, cc) => ((h + r * 7 + cc * 3 + i) % 3 !== 0 ? <Rect key={`${r}-${cc}`} x={x + 3 + cc * 6} y={120 - bh + 4 + r * 9} width={3.5} height={4.5} fill="#FFD36E" opacity={0.9} /> : null)))}
          </React.Fragment>); })}
        <Rect x={0} y={108} width={160} height={12} fill="#0B1330" />
      </>)}
      {kind === 'field' && (<>
        <Circle cx={124} cy={34} r={14} fill="#FFD84D" />
        <Ellipse cx={40} cy={30} rx={20} ry={8} fill="#FFFFFF" opacity={0.9} /><Ellipse cx={52} cy={26} rx={12} ry={7} fill="#FFFFFF" opacity={0.9} />
        <Path d="M0 84 Q 40 56 90 80 T 160 70 V120 H0 Z" fill="#7BD389" />
        <Path d="M0 100 Q 50 80 100 98 T 160 92 V120 H0 Z" fill="#4CB963" />
        <Path d="M112 96 V80 M112 80 h12 l-4 4 l4 4 h-12" stroke="#E5533D" strokeWidth={2.5} fill="#E5533D" />
        <Circle cx={30} cy={98} r={5} fill="#2E8B57" /><Rect x={28.5} y={100} width={3} height={8} fill="#5A3A1A" />
        <Circle cx={60} cy={104} r={4} fill="#2E8B57" /><Rect x={58.8} y={106} width={2.4} height={6} fill="#5A3A1A" />
      </>)}
    </Svg>
  );
}
