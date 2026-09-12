import React from 'react';
import type { VehicleId } from '@/types';
import { VehicleArt } from './vehicle-art';

/** 자체 디자인 배달원 아이콘 (이모지 대체) */
export function VehicleIcon({ id, size = 24, bubble = false, snail = false, sunk = false, ring }: { id: VehicleId; size?: number; bubble?: boolean; snail?: boolean; sunk?: boolean; ring?: string }) {
  return <VehicleArt id={id} size={size} bubble={bubble} ring={ring} snail={snail} sunk={sunk} />;
}
