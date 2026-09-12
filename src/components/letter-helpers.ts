import type { Letter, LetterStatus } from '@/types';
import { colors } from '@/theme';

export const STATUS_LABEL: Record<LetterStatus, { label: string; color: string; bg: string; emoji: string }> = {
  flying: { label: '이동 중', color: colors.blue, bg: colors.blueSoft, emoji: '🛫' },
  landed: { label: '착륙', color: '#8A6D00', bg: colors.yellowSoft, emoji: '📍' },
  delivered: { label: '답장 도착', color: colors.purple, bg: '#F3E8FF', emoji: '📬' },
  caught: { label: '잡힘', color: colors.green, bg: colors.greenSoft, emoji: '🎉' },
  approved: { label: '친구됨', color: colors.green, bg: colors.greenSoft, emoji: '🤝' },
  declined: { label: '거절됨', color: colors.text2, bg: colors.bg3, emoji: '🙅' },
  returned: { label: '반환됨', color: colors.orange, bg: '#FFF0E3', emoji: '↩️' },
  ocean: { label: '바다에 빠짐', color: colors.red, bg: colors.redSoft, emoji: '🌊' },
  space: { label: '우주로', color: colors.purple, bg: '#F3E8FF', emoji: '🪐' },
  expired: { label: '만료', color: colors.text3, bg: colors.bg3, emoji: '💤' },
};

export const EVENT_LABEL: Record<string, string> = {
  departed: '출발', passby: '누군가의 머리 위 통과', landed: '착륙', delivered: '우편함 도착', caught: '잡힘', approved: '승인 · 친구됨', declined: '거절',
  defended: '🛡️ 장난 방어 성공', rerouted: '🧭 경로 변경됨', snail: '🐌 달팽이 벌칙', returned: '↩️ 되돌아감', ocean: '🌊 바다에 빠짐', space: '🪐 우주로', expired: '만료',
};

export const letterTitle = (l: Letter) => `${l.origin.city} → ${l.destination.city}`;
export const hasTarget = (l: { target: Record<string, unknown> }) => !!(l.target.field || l.target.job || l.target.hobby || l.target.gender);
