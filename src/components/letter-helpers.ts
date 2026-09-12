import type { Letter, LetterStatus } from '@/types';
import type { ThemeColors } from '@/theme';
import type { ItemId } from './item-art';

export const statusLabel = (c: ThemeColors): Record<LetterStatus, { label: string; color: string; bg: string; icon: ItemId }> => ({
  flying: { label: '이동 중', color: c.blue, bg: c.blueSoft, icon: 'compass' },
  sunk: { label: '바다에 빠짐', color: c.red, bg: c.redSoft, icon: 'wave' },
  landed: { label: '착륙', color: c.yellowText, bg: c.yellowSoft, icon: 'pin' },
  delivered: { label: '도착 · 대기', color: c.purple, bg: c.purpleSoft, icon: 'mail' },
  caught: { label: '잡힘', color: c.green, bg: c.greenSoft, icon: 'party' },
  approved: { label: '친구됨', color: c.green, bg: c.greenSoft, icon: 'heart' },
  declined: { label: '거절됨', color: c.text2, bg: c.bg3, icon: 'lock' },
  returned: { label: '반환됨', color: c.orange, bg: c.yellowSoft, icon: 'return' },
  space: { label: '우주로', color: c.purple, bg: c.purpleSoft, icon: 'planet' },
  expired: { label: '만료', color: c.text3, bg: c.bg3, icon: 'clock' },
});
export const EVENT_LABEL: Record<string, string> = {
  departed: '출발', passby: '누군가의 머리 위 통과', landed: '착륙', delivered: '우편함 도착', caught: '잡힘', approved: '수락/확정', declined: '거절',
  defended: '🛡️ 장난 방어 성공', rerouted: '🧭 경로 변경됨', pulled: '🧲 끌려감', peeked: '🔍 누군가 엿봄', snail: '🐌 달팽이 벌칙', returned: '↩️ 되돌아감', sunk: '🌊 바다에 빠짐', rescued: '🛟 주인이 건져냄', resurfaced: '🌊 다시 떠오름', space: '🪐 우주로', expired: '만료',
};
export const letterTitle = (l: Letter) => `${l.origin.city} → ${l.destination.city}`;
export const hasTarget = (l: { target: Record<string, unknown> }) => !!(l.target.field || l.target.job || l.target.hobby || l.target.gender);
export const kindLabel = (l: Letter) => (l.kind === 'reply' ? '답장' : l.kind === 'accept' ? '수락 편지' : '편지');
