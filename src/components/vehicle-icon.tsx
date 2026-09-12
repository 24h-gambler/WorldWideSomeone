import React from 'react';
import { View } from 'react-native';
import type { VehicleId } from '@/types';
import { SNAIL, VEHICLE_MAP } from '@/data/vehicles';
import { T } from '@/components/ui';
import { colors, shadow } from '@/theme';

/** Zenly 버블 스타일 운송수단 아이콘 */
export function VehicleIcon({ id, size = 24, bubble = false, snail = false, ring }: { id: VehicleId; size?: number; bubble?: boolean; snail?: boolean; ring?: string }) {
  const emoji = snail ? SNAIL.emoji : VEHICLE_MAP[id].emoji;
  const glyph = <T style={{ fontSize: size * 0.62, lineHeight: size * 0.9, textAlign: 'center' }}>{emoji}</T>;
  if (!bubble) return glyph;
  return (
    <View style={[{ width: size, height: size, borderRadius: size, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2.5 : 0, borderColor: ring ?? colors.bg }, shadow.bubble]}>
      {glyph}
    </View>
  );
}
