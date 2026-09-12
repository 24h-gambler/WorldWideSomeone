import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

import type { VehicleId } from '@/types';
import { VEHICLE_MAP } from '@/data/vehicles';
import { T } from '@/components/ui';

/** 종이비행기 SVG (64×64, 위쪽을 향함). 지구 위에서는 진행 방향으로 회전시켜 쓴다. */
export function PaperPlanePaths({ color = '#F4F6FF', shade = '#B9C2EA' }: { color?: string; shade?: string }) {
  return (
    <>
      <Path d="M32 3 L59 59 L32 45 L5 59 Z" fill={color} />
      <Path d="M32 3 L32 45 L5 59 Z" fill={shade} />
      <Path d="M32 3 L59 59 L32 45 Z" fill={color} opacity={0.9} />
    </>
  );
}

/** 지구(SVG) 안에서 쓰는 마커: x,y 중심, size px, headingDeg는 화면 기준 시계방향 */
export function GlobeVehicleGlyph({ id, x, y, size, headingDeg = 0 }: { id: VehicleId; x: number; y: number; size: number; headingDeg?: number }) {
  if (id === 'paper') {
    const s = size / 64;
    return (
      <G transform={`translate(${x} ${y}) rotate(${headingDeg}) scale(${s}) translate(-32 -32)`}>
        <PaperPlanePaths />
      </G>
    );
  }
  return null;
}

/** 일반 뷰에서 쓰는 운송수단 아이콘 */
export function VehicleIcon({ id, size = 24 }: { id: VehicleId; size?: number }) {
  if (id === 'paper') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <G transform="rotate(35 32 32)">
          <PaperPlanePaths />
        </G>
      </Svg>
    );
  }
  return <T style={{ fontSize: size * 0.82, lineHeight: size * 1.1, textAlign: 'center' }}>{VEHICLE_MAP[id].emoji}</T>;
}
