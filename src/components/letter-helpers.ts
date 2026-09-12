import type { Letter, LetterStatus } from '@/types';
import { colors } from '@/theme';

export const STATUS_LABEL: Record<LetterStatus, { label: string; color: string; emoji: string }> = {
  flying: { label: '비행 중', color: colors.sky, emoji: '🛫' },
  landed: { label: '착륙', color: colors.gold, emoji: '📍' },
  caught: { label: '잡힘', color: colors.success, emoji: '🎉' },
  returned: { label: '반환됨', color: colors.warm, emoji: '↩️' },
  ocean: { label: '바다에 빠짐', color: colors.danger, emoji: '🌊' },
  space: { label: '우주로', color: colors.primary, emoji: '🪐' },
  expired: { label: '만료', color: colors.textFaint, emoji: '💤' },
};

export function letterTitle(l: Letter) {
  return `${l.origin.city} → ${l.destination.city}`;
}
