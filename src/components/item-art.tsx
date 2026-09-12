/**
 * 아이템·행동 아이콘 — 이모지 대신 직접 그린 SVG (64×64 좌표계, 배달원 아트와 같은 스티커 스타일)
 * 방어권·엿보기 렌즈·끌어오기 자석·나침반·달팽이·되돌리기·바다·로켓·번개·UFO·위성·양탄자·코인·구조 튜브·상점 가방·잡기·행성·편지·핀·축하·별·시계
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { ArtShapes, SNAIL_SHAPES } from './vehicle-art';

export type ItemId =
  | 'shield' | 'lens' | 'magnet' | 'compass' | 'snail' | 'return' | 'wave' | 'rocket' | 'bolt' | 'ufo' | 'satellite' | 'carpet'
  | 'coin' | 'coins' | 'lifebuoy' | 'bag' | 'catch' | 'planet' | 'mail' | 'pin' | 'party' | 'star' | 'clock' | 'heart' | 'lock';

const P = {
  blue: '#3B9BF5', blueDark: '#2477C9', blueSoft: '#DCEEFF', purple: '#8E5CF6', purpleDark: '#6B3FD1', red: '#F04A5E', redDark: '#C7293D',
  orange: '#FF8A3D', yellow: '#FFC93C', yellowDark: '#E0A61C', green: '#3DCB7A', greenDark: '#26A35C', cream: '#FFF6E3', sand: '#E8D5B2',
  white: '#FFFFFF', gray: '#C9D1DB', grayDark: '#8A96A6', dark: '#2B2F36', sky: '#8ED0FF', navy: '#1D4E89', pink: '#FF6FB5', gold: '#F5B342', goldDark: '#D68F14',
};

function shapes(id: ItemId): React.ReactNode {
  switch (id) {
    case 'shield':
      return (<>
        <Path d="M32 6 L54 14 V30 C54 44 44 54 32 58 C20 54 10 44 10 30 V14 Z" fill={P.blue} />
        <Path d="M32 12 L48 18 V30 C48 40 41 48 32 52 Z" fill={P.blueDark} opacity={0.35} />
        <Path d="M22 31 L29 38 L43 24" stroke={P.white} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>);
    case 'lens':
      return (<>
        <Line x1={40} y1={40} x2={56} y2={56} stroke={P.purpleDark} strokeWidth={9} strokeLinecap="round" />
        <Circle cx={27} cy={27} r={19} fill={P.blueSoft} stroke={P.purple} strokeWidth={7} />
        <Path d="M16 24 Q 18 14 28 12" stroke={P.white} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.9} />
        <Circle cx={30} cy={30} r={3} fill={P.purple} opacity={0.5} />
      </>);
    case 'magnet':
      return (<>
        <Path d="M18 12 V32 A14 14 0 0 0 46 32 V12" stroke={P.red} strokeWidth={13} fill="none" strokeLinecap="butt" />
        <Rect x={11} y={8} width={14} height={12} rx={2} fill={P.gray} />
        <Rect x={39} y={8} width={14} height={12} rx={2} fill={P.gray} />
        <Path d="M22 22 V32 A10 10 0 0 0 42 32 V22" stroke={P.white} strokeWidth={2} fill="none" opacity={0.5} />
        <Path d="M10 54 Q 14 48 18 54 M24 58 Q 28 52 32 58 M38 54 Q 42 48 46 54" stroke={P.blue} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </>);
    case 'compass':
      return (<>
        <Circle cx={32} cy={32} r={24} fill={P.white} stroke={P.gray} strokeWidth={4} />
        <Circle cx={32} cy={32} r={19} fill="none" stroke={P.blueSoft} strokeWidth={2} />
        <Polygon points="32,12 38,32 26,32" fill={P.red} />
        <Polygon points="32,52 38,32 26,32" fill={P.grayDark} />
        <Circle cx={32} cy={32} r={4} fill={P.dark} />
        <Line x1={32} y1={9} x2={32} y2={13} stroke={P.dark} strokeWidth={2} /><Line x1={55} y1={32} x2={51} y2={32} stroke={P.dark} strokeWidth={2} /><Line x1={32} y1={55} x2={32} y2={51} stroke={P.dark} strokeWidth={2} /><Line x1={9} y1={32} x2={13} y2={32} stroke={P.dark} strokeWidth={2} />
      </>);
    case 'snail':
      return <>{SNAIL_SHAPES}</>;
    case 'return':
      return (<>
        <Path d="M50 22 H26 A12 12 0 0 0 26 46 H40" stroke={P.orange} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Polygon points="52,22 40,12 40,32" fill={P.orange} />
        <Circle cx={46} cy={46} r={4} fill={P.orange} opacity={0.5} />
      </>);
    case 'wave':
      return (<>
        <Path d="M6 28 Q 14 18 22 28 T 38 28 T 54 28 T 62 28" stroke={P.blue} strokeWidth={6} fill="none" strokeLinecap="round" />
        <Path d="M6 42 Q 14 32 22 42 T 38 42 T 54 42 T 62 42" stroke={P.sky} strokeWidth={6} fill="none" strokeLinecap="round" />
        <Circle cx={44} cy={14} r={3} fill={P.sky} /><Circle cx={52} cy={10} r={2} fill={P.sky} />
      </>);
    case 'rocket': case 'ufo': case 'satellite': case 'carpet':
      return <ArtShapes id={id} />;
    case 'bolt':
      return (<>
        <Polygon points="36,4 14,36 30,36 26,60 50,26 34,26" fill={P.yellow} stroke={P.yellowDark} strokeWidth={2} strokeLinejoin="round" />
        <Polygon points="33,10 20,32 30,32 28,48" fill={P.white} opacity={0.35} />
      </>);
    case 'coin':
      return (<>
        <Circle cx={32} cy={32} r={24} fill={P.gold} />
        <Circle cx={32} cy={32} r={17} fill="none" stroke={P.goldDark} strokeWidth={3} />
        <Path d="M22 24 L27 42 L32 30 L37 42 L42 24" stroke={P.goldDark} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 22 Q 18 12 28 9" stroke={P.white} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
      </>);
    case 'coins':
      return (<>
        <Ellipse cx={28} cy={48} rx={20} ry={7} fill={P.goldDark} />
        <Ellipse cx={28} cy={44} rx={20} ry={7} fill={P.gold} />
        <Ellipse cx={28} cy={36} rx={20} ry={7} fill={P.goldDark} />
        <Ellipse cx={28} cy={32} rx={20} ry={7} fill={P.gold} />
        <Circle cx={46} cy={20} r={11} fill={P.gold} stroke={P.goldDark} strokeWidth={2} />
        <Path d="M42 15 L44 25 L46 19 L48 25 L50 15" stroke={P.goldDark} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </>);
    case 'lifebuoy':
      return (<>
        <Circle cx={32} cy={32} r={22} fill="none" stroke={P.red} strokeWidth={12} />
        <Circle cx={32} cy={32} r={22} fill="none" stroke={P.white} strokeWidth={12} strokeDasharray="17 17.5" strokeDashoffset={8} />
        <Circle cx={32} cy={32} r={22} fill="none" stroke={P.gray} strokeWidth={1.5} /><Circle cx={32} cy={32} r={10} fill="none" stroke={P.gray} strokeWidth={1.5} />
      </>);
    case 'bag':
      return (<>
        <Path d="M14 22 H50 L54 56 H10 Z" fill={P.pink} />
        <Path d="M14 22 H50 L52 40 H12 Z" fill={P.white} opacity={0.18} />
        <Path d="M23 22 V17 A9 9 0 0 1 41 17 V22" stroke={P.dark} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      </>);
    case 'catch':
      return (<>
        <Rect x={12} y={20} width={40} height={28} rx={4} fill={P.cream} stroke={P.sand} strokeWidth={2} />
        <Path d="M12 22 L32 38 L52 22" stroke={P.orange} strokeWidth={2.5} fill="none" />
        <Path d="M8 46 Q 6 58 16 60 H46 Q 58 60 56 48" stroke={P.sand} strokeWidth={6} fill="none" strokeLinecap="round" />
        <Polygon points="52,8 54,13 59,14 55,17 56,22 52,19 48,22 49,17 45,14 50,13" fill={P.yellow} />
        <Circle cx={12} cy={12} r={3} fill={P.pink} />
      </>);
    case 'planet':
      return (<>
        <Circle cx={32} cy={32} r={16} fill={P.purple} />
        <Path d="M22 24 Q 32 18 42 26" stroke={P.white} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.5} />
        <Ellipse cx={32} cy={34} rx={28} ry={8} fill="none" stroke={P.yellow} strokeWidth={4} transform="rotate(-18 32 34)" />
        <Circle cx={12} cy={12} r={2} fill={P.yellow} /><Circle cx={54} cy={50} r={2.5} fill={P.sky} />
      </>);
    case 'mail':
      return (<>
        <Rect x={8} y={16} width={48} height={34} rx={5} fill={P.blue} />
        <Path d="M8 20 L32 38 L56 20" stroke={P.white} strokeWidth={3} fill="none" />
        <Rect x={8} y={16} width={48} height={34} rx={5} fill="none" stroke={P.blueDark} strokeWidth={2} />
      </>);
    case 'pin':
      return (<>
        <Path d="M32 58 C 22 44 16 36 16 26 A16 16 0 0 1 48 26 C 48 36 42 44 32 58 Z" fill={P.red} />
        <Circle cx={32} cy={26} r={7} fill={P.white} />
      </>);
    case 'party':
      return (<>
        <Polygon points="14,54 26,22 44,40" fill={P.orange} />
        <Polygon points="14,54 22,34 34,46" fill={P.yellow} opacity={0.7} />
        <Circle cx={46} cy={14} r={3} fill={P.pink} /><Circle cx={54} cy={26} r={2.5} fill={P.blue} /><Circle cx={36} cy={10} r={2.5} fill={P.green} />
        <Path d="M40 24 q 6 -8 12 -4" stroke={P.purple} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </>);
    case 'star':
      return <Polygon points="32,6 40,24 60,26 45,39 49,58 32,48 15,58 19,39 4,26 24,24" fill={P.yellow} stroke={P.yellowDark} strokeWidth={2} strokeLinejoin="round" />;
    case 'clock':
      return (<>
        <Circle cx={32} cy={32} r={24} fill={P.white} stroke={P.gray} strokeWidth={4} />
        <Line x1={32} y1={32} x2={32} y2={16} stroke={P.dark} strokeWidth={4} strokeLinecap="round" /><Line x1={32} y1={32} x2={43} y2={38} stroke={P.dark} strokeWidth={4} strokeLinecap="round" />
      </>);
    case 'heart':
      return <Path d="M32 56 C 12 42 6 32 10 22 C 14 12 28 12 32 22 C 36 12 50 12 54 22 C 58 32 52 42 32 56 Z" fill={P.red} />;
    case 'lock':
      return (<>
        <Rect x={14} y={28} width={36} height={28} rx={6} fill={P.grayDark} />
        <Path d="M22 28 V20 A10 10 0 0 1 42 20 V28" stroke={P.grayDark} strokeWidth={6} fill="none" />
        <Circle cx={32} cy={42} r={4} fill={P.white} />
      </>);
  }
}

/** 일반 뷰용 아이템 아이콘 */
export function ItemIcon({ id, size = 24, bubble, bg }: { id: ItemId; size?: number; bubble?: boolean; bg?: string }) {
  const inner = <Svg width={bubble ? size * 0.68 : size} height={bubble ? size * 0.68 : size} viewBox="0 0 64 64">{shapes(id)}</Svg>;
  if (!bubble) return inner;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? '#fff', alignItems: 'center', justifyContent: 'center' }}>{inner}</View>;
}

/** SVG 안에서(지구 마커 등) 쓰는 도형 묶음 */
export function ItemShapes({ id, x, y, size }: { id: ItemId; x: number; y: number; size: number }) {
  const s = size / 64;
  return <G transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}>{shapes(id)}</G>;
}

/** 상품 id → 아이콘 */
export const PRODUCT_ICON: Record<string, ItemId> = { shield5: 'shield', peek5: 'lens', pull1: 'magnet', instant1: 'bolt', ufo1: 'ufo', orbit1: 'satellite', coins300: 'coin', coins1000: 'coins' };
