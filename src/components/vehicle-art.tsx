/**
 * 자체 디자인 배달원 아이콘 — 64×64 박스, 오른쪽(동쪽)을 향함. 플랫 + 둥근 형태 + 한 톤 어두운 그림자 + 흰 하이라이트.
 * 지구(SVG) 안에서는 <ArtShapes/> 를 G 로 감싸 쓰고, 일반 뷰에서는 <VehicleArt/> 로 쓴다.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import type { VehicleId } from '@/types';
import { shadow } from '@/theme';

const C = { red: '#FF5A5F', orange: '#FF9F43', yellow: '#FFD166', green: '#06D6A0', blue: '#118AB2', navy: '#073B4C', purple: '#7B61FF', pink: '#FF7AB6', gray: '#B0B7C3', dark: '#2D3142', white: '#FFFFFF', skin: '#F6C89F', brown: '#8D5B3E', sky: '#5AC8FA', sand: '#E5B25D', cream: '#FBF4E4' };
const shade = (hex: string, k = 0.78) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (x: number) => Math.max(0, Math.min(255, Math.round(x * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

// ---------- 공통 부품 ----------
const Wheel = ({ x, y, r = 6 }: { x: number; y: number; r?: number }) => (
  <>
    <Circle cx={x} cy={y} r={r} fill={C.dark} />
    <Circle cx={x} cy={y} r={r * 0.45} fill={C.gray} />
  </>
);
const Eye = ({ x, y, r = 1.6 }: { x: number; y: number; r?: number }) => <Circle cx={x} cy={y} r={r} fill={C.dark} />;
const Motion = ({ x, y, n = 3, len = 8 }: { x: number; y: number; n?: number; len?: number }) => (
  <>{Array.from({ length: n }).map((_, i) => <Line key={i} x1={x} y1={y + i * 4} x2={x - len + i * 2} y2={y + i * 4} stroke={C.gray} strokeWidth={2} strokeLinecap="round" opacity={0.7} />)}</>
);

function Person({ shirt, pose }: { shirt: string; pose: 'walk' | 'jog' | 'run' }) {
  const stride = pose === 'walk' ? 5 : pose === 'jog' ? 8 : 12;
  const lean = pose === 'run' ? 4 : pose === 'jog' ? 2 : 0;
  return (
    <>
      {pose !== 'walk' && <Motion x={20} y={30} n={pose === 'run' ? 3 : 2} len={pose === 'run' ? 10 : 6} />}
      {/* 다리 */}
      <Line x1={32 + lean} y1={40} x2={32 - stride} y2={56} stroke={C.navy} strokeWidth={5} strokeLinecap="round" />
      <Line x1={32 + lean} y1={40} x2={32 + stride + 2} y2={55} stroke={C.navy} strokeWidth={5} strokeLinecap="round" />
      {/* 몸 */}
      <Rect x={26 + lean} y={24} width={13} height={18} rx={6} fill={shirt} />
      {/* 팔 */}
      <Line x1={30 + lean} y1={28} x2={22 + lean - stride / 2} y2={36} stroke={shirt} strokeWidth={4.5} strokeLinecap="round" />
      <Line x1={36 + lean} y1={28} x2={44 + lean + stride / 2} y2={34} stroke={C.skin} strokeWidth={4.5} strokeLinecap="round" />
      {/* 머리 */}
      <Circle cx={33 + lean} cy={16} r={7} fill={C.skin} />
      <Path d={`M${26 + lean} 15 a7 7 0 0 1 14 0 v-2 a7 5 0 0 0 -14 0z`} fill={C.dark} />
      {/* 편지 */}
      <Rect x={44 + lean + stride / 2} y={30} width={9} height={7} rx={1.5} fill={C.cream} stroke={C.orange} strokeWidth={1} />
    </>
  );
}

function Bird({ body, wing, beak = C.orange, size = 1, neck = 0, legs = false, whiteHead = false, spread = 1 }: { body: string; wing: string; beak?: string; size?: number; neck?: number; legs?: boolean; whiteHead?: boolean; spread?: number }) {
  const s = size;
  return (
    <G transform={`translate(32 34) scale(${s}) translate(-32 -34)`}>
      {legs && <><Line x1={30} y1={42} x2={26} y2={54} stroke={C.dark} strokeWidth={1.6} /><Line x1={34} y1={42} x2={31} y2={54} stroke={C.dark} strokeWidth={1.6} /></>}
      {/* 꼬리 */}
      <Polygon points={`14,36 22,32 22,40`} fill={shade(body)} />
      {/* 몸 */}
      <Ellipse cx={32} cy={36} rx={13} ry={8} fill={body} />
      {/* 뒷날개 */}
      <Path d={`M24 34 Q ${18 - 6 * spread} ${20 - 8 * spread} ${30 - 4 * spread} ${18 - 6 * spread} Q 36 24 34 34 Z`} fill={shade(wing, 0.7)} />
      {/* 앞날개 */}
      <Path d={`M28 34 Q ${28 + 4 * spread} ${16 - 10 * spread} ${46 + 6 * spread} ${22 - 6 * spread} Q 40 32 32 36 Z`} fill={wing} />
      {/* 목·머리 */}
      {neck > 0 && <Line x1={42} y1={33} x2={46 + neck} y2={26 - neck} stroke={body} strokeWidth={5} strokeLinecap="round" />}
      <Circle cx={46 + neck} cy={26 - neck} r={5.5} fill={whiteHead ? C.white : body} />
      <Polygon points={`${51 + neck},${26 - neck} ${58 + neck},${28 - neck} ${51 + neck},${29 - neck}`} fill={beak} />
      <Eye x={47.5 + neck} y={25 - neck} r={1.3} />
    </G>
  );
}

function Quadruped({ body, mane, spots, humps, horn }: { body: string; mane?: string; spots?: boolean; humps?: boolean; horn?: boolean }) {
  return (
    <>
      {/* 다리 */}
      {[20, 27, 39, 46].map((x, i) => <Line key={i} x1={x} y1={40} x2={x + (i % 2 ? 2 : -3)} y2={54} stroke={shade(body, 0.7)} strokeWidth={4} strokeLinecap="round" />)}
      {/* 몸 */}
      <Ellipse cx={33} cy={36} rx={16} ry={9} fill={body} />
      {humps && <><Circle cx={28} cy={28} r={6} fill={body} /><Circle cx={38} cy={28} r={6} fill={body} /></>}
      {spots && [[26, 33], [33, 38], [38, 31], [42, 38], [30, 41]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.6} fill={shade(body, 0.55)} />)}
      {/* 꼬리 */}
      <Path d="M17 34 Q 10 30 12 40" stroke={mane ?? shade(body, 0.7)} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* 목·머리 */}
      <Path d="M44 34 L52 20" stroke={body} strokeWidth={7} strokeLinecap="round" />
      <Ellipse cx={54} cy={19} rx={7} ry={4.5} fill={body} />
      {mane && <Path d="M40 28 Q 46 14 52 16" stroke={mane} strokeWidth={4} fill="none" strokeLinecap="round" />}
      {horn && <Polygon points="52,14 55,4 57,15" fill={C.yellow} />}
      <Eye x={55} y={18} r={1.3} />
      <Circle cx={60} cy={20} r={1.2} fill={shade(body, 0.6)} />
    </>
  );
}

function Car({ color, low = false, long = false, tall = false, spoiler = false, box = false }: { color: string; low?: boolean; long?: boolean; tall?: boolean; spoiler?: boolean; box?: boolean }) {
  const x0 = long ? 6 : 10;
  const w = long ? 52 : 44;
  const roofH = low ? 8 : tall ? 16 : 12;
  const bodyY = 36;
  return (
    <>
      <Rect x={x0} y={bodyY} width={w} height={12} rx={4} fill={color} />
      <Rect x={x0} y={bodyY + 8} width={w} height={4} rx={2} fill={shade(color)} />
      {box ? (
        <Rect x={x0 + 4} y={bodyY - roofH} width={w - 8} height={roofH + 2} rx={3} fill={color} />
      ) : (
        <Path d={`M${x0 + 10} ${bodyY} L${x0 + 16} ${bodyY - roofH} L${x0 + w - 16} ${bodyY - roofH} L${x0 + w - 8} ${bodyY} Z`} fill={color} />
      )}
      <Path d={box ? `M${x0 + 7} ${bodyY - roofH + 3} h${w - 14} v${roofH - 5} h-${w - 14} z` : `M${x0 + 13} ${bodyY - 1} L${x0 + 17} ${bodyY - roofH + 2} L${x0 + w - 17} ${bodyY - roofH + 2} L${x0 + w - 11} ${bodyY - 1} Z`} fill={C.sky} opacity={0.9} />
      {spoiler && <Rect x={x0 - 2} y={bodyY - 4} width={12} height={3} rx={1.5} fill={C.dark} />}
      <Circle cx={x0 + w - 3} cy={bodyY + 4} r={1.8} fill={C.yellow} />
      <Wheel x={x0 + 11} y={bodyY + 12} r={low ? 5.5 : 6} />
      <Wheel x={x0 + w - 11} y={bodyY + 12} r={low ? 5.5 : 6} />
      {low && <Motion x={x0 - 2} y={38} n={3} len={8} />}
    </>
  );
}

function Train({ color, nose = false, sleek = false }: { color: string; nose?: boolean; sleek?: boolean }) {
  return (
    <>
      {sleek && <Rect x={4} y={50} width={56} height={3} rx={1.5} fill={C.gray} />}
      <Path d={nose ? 'M6 30 h40 q14 0 14 12 v6 h-54 z' : 'M6 28 h50 q4 0 4 4 v16 h-54 z'} fill={color} />
      {[12, 24, 36].map((x) => <Rect key={x} x={x} y={33} width={8} height={6} rx={1.5} fill={C.sky} />)}
      <Rect x={6} y={44} width={54} height={3} fill={shade(color)} />
      {!sleek && <><Wheel x={16} y={50} r={4} /><Wheel x={30} y={50} r={4} /><Wheel x={46} y={50} r={4} /></>}
      {sleek && <Motion x={4} y={34} n={3} len={8} />}
    </>
  );
}

function Boat({ hull, sail = false, cabin = false, decks = 0, wake = false }: { hull: string; sail?: boolean; cabin?: boolean; decks?: number; wake?: boolean }) {
  return (
    <>
      <Path d="M6 52 Q 32 60 58 52 L 52 42 L 12 42 Z" fill={hull} />
      <Path d="M6 52 Q 32 60 58 52 L 56 55 Q 32 62 8 55 Z" fill={shade(hull)} />
      {sail && <><Line x1={30} y1={42} x2={30} y2={12} stroke={C.dark} strokeWidth={2} /><Polygon points="32,14 52,40 32,40" fill={C.white} /><Polygon points="28,18 14,40 28,40" fill={C.red} /></>}
      {cabin && <><Rect x={30} y={32} width={16} height={10} rx={3} fill={C.white} /><Rect x={40} y={34} width={5} height={5} rx={1} fill={C.sky} /><Motion x={10} y={46} n={2} len={6} /></>}
      {decks > 0 && Array.from({ length: decks }).map((_, i) => <Rect key={i} x={14 + i * 4} y={42 - (i + 1) * 7} width={36 - i * 8} height={7} rx={2} fill={i % 2 ? C.white : '#EEF2F7'} />)}
      {decks > 0 && <><Rect x={40} y={16} width={4} height={8} fill={C.red} /><Rect x={32} y={16} width={4} height={8} fill={C.red} /></>}
      {wake && <><Path d="M6 56 Q 12 54 18 56" stroke={C.sky} strokeWidth={2} fill="none" /><Path d="M46 56 Q 52 54 58 56" stroke={C.sky} strokeWidth={2} fill="none" /></>}
    </>
  );
}

function Plane({ color, delta = false, prop = false, windows = true, concorde = false }: { color: string; delta?: boolean; prop?: boolean; windows?: boolean; concorde?: boolean }) {
  return (
    <>
      {/* 꼬리날개 */}
      <Polygon points="8,26 16,26 12,16" fill={shade(color)} />
      {/* 날개 */}
      <Polygon points={delta ? '20,36 46,36 40,50 30,50' : '24,34 44,34 34,50 26,50'} fill={shade(color, 0.85)} />
      <Polygon points={delta ? '20,32 46,32 40,20 30,20' : '24,34 44,34 34,20 26,20'} fill={shade(color, 0.85)} />
      {/* 동체 */}
      <Path d={concorde ? 'M8 32 Q 8 27 14 27 L 50 27 Q 62 30 64 36 L 54 37 L 14 37 Q 8 37 8 32 Z' : 'M8 33 Q 8 27 16 27 L 48 27 Q 60 27 60 33 Q 60 39 48 39 L 16 39 Q 8 39 8 33 Z'} fill={color} />
      {windows && [22, 29, 36, 43].map((x) => <Circle key={x} cx={x} cy={31} r={1.6} fill={C.sky} />)}
      {prop && <><Circle cx={60} cy={33} r={2.5} fill={C.dark} /><Line x1={60} y1={24} x2={60} y2={42} stroke={C.gray} strokeWidth={2} strokeLinecap="round" /></>}
      <Motion x={6} y={31} n={2} len={6} />
    </>
  );
}

// ---------- 개별 아이콘 ----------
function shapes(id: VehicleId): React.ReactNode {
  switch (id) {
    case 'walk': return <Person shirt={C.green} pose="walk" />;
    case 'jog': return <Person shirt={C.orange} pose="jog" />;
    case 'run': return <Person shirt={C.red} pose="run" />;
    case 'kick': return <><Line x1={44} y1={14} x2={44} y2={50} stroke={C.dark} strokeWidth={3} strokeLinecap="round" /><Line x1={38} y1={14} x2={50} y2={14} stroke={C.dark} strokeWidth={3} strokeLinecap="round" /><Rect x={14} y={48} width={34} height={5} rx={2.5} fill={C.green} /><Wheel x={16} y={54} r={4} /><Wheel x={46} y={54} r={4} /><Person shirt={C.blue} pose="walk" /></>;
    case 'bike': return <><Wheel x={16} y={48} r={9} /><Wheel x={48} y={48} r={9} /><Path d="M16 48 L28 30 L44 30 L48 48 M28 30 L34 48 L16 48" stroke={C.blue} strokeWidth={3} fill="none" strokeLinejoin="round" /><Line x1={42} y1={30} x2={46} y2={24} stroke={C.dark} strokeWidth={3} /><Circle cx={34} cy={16} r={6} fill={C.skin} /><Path d="M28 15 a6 6 0 0 1 12 0z" fill={C.red} /><Rect x={27} y={22} width={12} height={12} rx={5} fill={C.yellow} /></>;
    case 'pigeon': return <Bird body={C.gray} wing="#8E95A3" size={0.9} />;
    case 'seagull': return <Bird body={C.white} wing="#D6DBE3" beak={C.yellow} spread={1.3} />;
    case 'goose': return <Bird body={C.brown} wing="#6B4530" beak={C.orange} neck={5} size={1.05} />;
    case 'crane': return <Bird body={C.white} wing="#C9D2DD" beak={C.dark} neck={8} legs spread={1.2} />;
    case 'hawk': return <Bird body="#A0522D" wing="#7A3E1D" beak={C.yellow} size={1.05} spread={1.2} />;
    case 'eagle': return <Bird body="#5A3A1E" wing="#3E2712" beak={C.yellow} whiteHead size={1.15} spread={1.4} />;
    case 'albatross': return <Bird body={C.white} wing="#DDE3EA" beak={C.pink} size={1.1} spread={1.9} />;
    case 'horse': return <Quadruped body="#B0713A" mane="#5A3A1E" />;
    case 'camel': return <Quadruped body={C.sand} humps />;
    case 'dolphin': return <><Path d="M8 38 Q 20 22 44 26 Q 56 30 58 38 Q 50 46 36 46 Q 18 46 8 38 Z" fill={C.sky} /><Path d="M28 26 L34 14 L40 26 Z" fill={shade(C.sky)} /><Path d="M8 38 L2 30 L4 44 Z" fill={shade(C.sky)} /><Path d="M14 40 Q 32 48 52 40" stroke={C.white} strokeWidth={3} fill="none" opacity={0.7} /><Eye x={50} y={34} /><Path d="M4 50 Q 16 46 28 50 T 52 50" stroke={C.blue} strokeWidth={2} fill="none" opacity={0.6} /></>;
    case 'cheetah': return <><Quadruped body={C.sand} spots /><Motion x={12} y={30} n={3} len={8} /></>;
    case 'scooter': return <><Wheel x={16} y={50} r={7} /><Wheel x={48} y={50} r={7} /><Path d="M20 44 L36 44 L44 30 L52 30" stroke={C.pink} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /><Rect x={16} y={36} width={16} height={6} rx={3} fill={C.dark} /><Polygon points="48,30 56,14 60,16 52,32" fill={C.sky} opacity={0.9} /><Circle cx={30} cy={14} r={6} fill={C.skin} /><Path d="M24 13 a6 6 0 0 1 12 0z" fill={C.yellow} /><Rect x={24} y={20} width={12} height={14} rx={5} fill={C.blue} /></>;
    case 'kei': return <Car color={C.yellow} tall box />;
    case 'bus': return <><Rect x={6} y={22} width={52} height={28} rx={5} fill={C.green} />{[11, 22, 33, 44].map((x) => <Rect key={x} x={x} y={27} width={8} height={9} rx={1.5} fill={C.sky} />)}<Rect x={6} y={42} width={52} height={4} fill={shade(C.green)} /><Wheel x={16} y={50} r={5} /><Wheel x={48} y={50} r={5} /><Circle cx={56} cy={40} r={1.8} fill={C.yellow} /></>;
    case 'sedan': return <Car color={C.purple} long />;
    case 'truck': return <><Rect x={6} y={22} width={30} height={26} rx={3} fill={C.orange} /><Rect x={38} y={30} width={20} height={18} rx={3} fill={C.orange} /><Rect x={41} y={33} width={10} height={7} rx={1.5} fill={C.sky} /><Rect x={6} y={42} width={52} height={4} fill={shade(C.orange)} /><Wheel x={16} y={50} r={5} /><Wheel x={48} y={50} r={5} /><Circle cx={57} cy={44} r={1.6} fill={C.yellow} /><Circle cx={21} cy={35} r={5} fill={C.white} opacity={0.9} /><Path d="M18 35 l2 2 l4 -4" stroke={C.green} strokeWidth={1.6} fill="none" /></>;
    case 'sports': return <Car color={C.red} low long spoiler />;
    case 'train': return <Train color={C.dark} />;
    case 'ktx': return <Train color={C.purple} nose />;
    case 'maglev': return <Train color={C.blue} nose sleek />;
    case 'sail': return <Boat hull={C.navy} sail />;
    case 'speedboat': return <Boat hull={C.sky} cabin wake />;
    case 'cruise': return <Boat hull={C.navy} decks={2} />;
    case 'submarine': return <><Ellipse cx={32} cy={38} rx={24} ry={9} fill={C.navy} /><Rect x={28} y={22} width={12} height={10} rx={3} fill={C.navy} /><Line x1={36} y1={22} x2={36} y2={14} stroke={C.navy} strokeWidth={3} /><Line x1={36} y1={14} x2={42} y2={14} stroke={C.navy} strokeWidth={3} strokeLinecap="round" />{[22, 32, 42].map((x) => <Circle key={x} cx={x} cy={38} r={2.5} fill={C.sky} />)}<Polygon points="8,36 2,30 2,46" fill={shade(C.navy)} /><Circle cx={12} cy={28} r={1.5} fill={C.sky} opacity={0.6} /><Circle cx={16} cy={22} r={2} fill={C.sky} opacity={0.5} /></>;
    case 'hover': return <><Ellipse cx={32} cy={48} rx={26} ry={7} fill={C.dark} /><Ellipse cx={32} cy={46} rx={24} ry={5} fill={C.gray} /><Rect x={14} y={30} width={30} height={14} rx={5} fill={C.green} /><Rect x={30} y={33} width={10} height={6} rx={1.5} fill={C.sky} /><Circle cx={50} cy={36} r={7} fill={shade(C.green)} /><Circle cx={50} cy={36} r={3} fill={C.gray} /></>;
    case 'balloon': return <><Path d="M32 8 a16 18 0 0 1 16 18 q0 12 -12 18 h-8 q-12 -6 -12 -18 a16 18 0 0 1 16 -18z" fill={C.red} /><Path d="M32 8 q6 0 6 18 q0 12 -3 18 h-6 q-3 -6 -3 -18 q0 -18 6 -18z" fill={C.yellow} /><Path d="M32 8 a16 18 0 0 1 16 18 q0 12 -12 18 h-1 q9 -6 9 -18 a14 18 0 0 0 -12 -18z" fill={shade(C.red)} /><Line x1={26} y1={44} x2={26} y2={52} stroke={C.dark} strokeWidth={1.5} /><Line x1={38} y1={44} x2={38} y2={52} stroke={C.dark} strokeWidth={1.5} /><Rect x={24} y={52} width={16} height={7} rx={2} fill={C.brown} /></>;
    case 'paraglider': return <><Path d="M8 22 Q 32 4 56 22 Q 44 18 32 20 Q 20 18 8 22 Z" fill={C.yellow} /><Path d="M8 22 Q 32 8 56 22" stroke={shade(C.yellow)} strokeWidth={2} fill="none" />{[12, 22, 32, 42, 52].map((x) => <Line key={x} x1={x} y1={22} x2={32} y2={44} stroke={C.gray} strokeWidth={1} />)}<Circle cx={32} cy={42} r={5} fill={C.skin} /><Rect x={27} y={46} width={10} height={12} rx={4} fill={C.blue} /></>;
    case 'heli': return <><Line x1={10} y1={14} x2={54} y2={14} stroke={C.dark} strokeWidth={3} strokeLinecap="round" /><Line x1={32} y1={14} x2={32} y2={24} stroke={C.dark} strokeWidth={3} /><Path d="M14 34 L26 34 L26 26 Q 26 22 30 22 L 44 22 Q 56 22 56 34 Q 56 44 44 44 L 30 44 Q 26 44 26 40 Z" fill={C.orange} /><Path d="M14 34 L6 30 L6 38 Z" fill={C.orange} /><Circle cx={8} cy={30} r={4} fill={C.dark} opacity={0.8} /><Rect x={40} y={26} width={12} height={9} rx={3} fill={C.sky} /><Line x1={28} y1={50} x2={54} y2={50} stroke={C.dark} strokeWidth={2.5} strokeLinecap="round" /><Line x1={32} y1={44} x2={32} y2={50} stroke={C.dark} strokeWidth={2} /><Line x1={48} y1={44} x2={48} y2={50} stroke={C.dark} strokeWidth={2} /></>;
    case 'prop': return <Plane color={C.sky} prop windows={false} />;
    case 'airliner': return <Plane color={C.white} />;
    case 'fighter': return <><Plane color={C.dark} delta windows={false} /><Polygon points="56,30 64,33 56,36" fill={C.orange} /></>;
    case 'concorde': return <Plane color={C.white} delta windows concorde />;
    case 'rocket': return <><Path d="M20 34 Q 20 12 32 6 Q 44 12 44 34 L 44 44 L 20 44 Z" fill={C.white} /><Path d="M32 6 Q 44 12 44 34 L 44 44 L 36 44 L 36 34 Q 36 14 32 6 Z" fill="#E6EAF0" /><Circle cx={32} cy={26} r={5} fill={C.sky} /><Polygon points="20,36 12,50 20,46" fill={C.red} /><Polygon points="44,36 52,50 44,46" fill={C.red} /><Rect x={24} y={44} width={16} height={4} fill={C.red} /><Path d="M26 48 Q 32 62 38 48 Z" fill={C.orange} /><Path d="M29 48 Q 32 56 35 48 Z" fill={C.yellow} /></>;
    case 'satellite': return <><Rect x={6} y={26} width={18} height={12} rx={2} fill={C.blue} />{[9, 13, 17, 21].map((x) => <Line key={x} x1={x} y1={26} x2={x} y2={38} stroke={C.sky} strokeWidth={1} />)}<Rect x={40} y={26} width={18} height={12} rx={2} fill={C.blue} />{[43, 47, 51, 55].map((x) => <Line key={x} x1={x} y1={26} x2={x} y2={38} stroke={C.sky} strokeWidth={1} />)}<Rect x={25} y={22} width={14} height={20} rx={3} fill={C.gray} /><Rect x={28} y={26} width={8} height={5} rx={1} fill={C.dark} /><Path d="M32 22 L32 14 M26 14 Q 32 8 38 14" stroke={C.dark} strokeWidth={2} fill="none" /><Circle cx={32} cy={48} r={3} fill={C.yellow} /></>;
    case 'ufo': return <><Ellipse cx={32} cy={26} rx={12} ry={10} fill={C.sky} opacity={0.85} /><Circle cx={32} cy={24} r={5} fill={C.green} /><Ellipse cx={32} cy={36} rx={26} ry={9} fill={C.gray} /><Ellipse cx={32} cy={34} rx={26} ry={7} fill="#D6DBE3" />{[14, 23, 32, 41, 50].map((x, i) => <Circle key={x} cx={x} cy={38} r={2.2} fill={[C.red, C.yellow, C.green, C.pink, C.purple][i]} />)}<Polygon points="24,44 40,44 46,58 18,58" fill={C.yellow} opacity={0.35} /></>;
    case 'carpet': return <><Path d="M6 40 Q 16 30 26 40 T 46 40 T 58 40 L 58 48 Q 48 56 40 48 T 24 48 T 6 48 Z" fill={C.purple} /><Path d="M6 40 Q 16 30 26 40 T 46 40 T 58 40 L 58 43 Q 48 50 40 43 T 24 43 T 6 43 Z" fill={C.pink} opacity={0.6} />{[8, 56].map((x) => [0, 3, 6].map((d) => <Line key={x + d} x1={x} y1={48 + d} x2={x} y2={52 + d} stroke={C.yellow} strokeWidth={1.2} />))}<Circle cx={32} cy={20} r={6} fill={C.skin} /><Rect x={25} y={26} width={14} height={12} rx={5} fill={C.yellow} /><Path d="M26 19 a6 6 0 0 1 12 0z" fill={C.red} /></>;
    case 'unicorn': return <><Quadruped body={C.white} mane={C.pink} horn /><Path d="M40 28 Q 46 14 52 16" stroke={C.purple} strokeWidth={2} fill="none" /></>;
    case 'dragon': return <><Path d="M14 40 Q 20 20 34 32 Q 44 40 56 30" stroke={C.green} strokeWidth={9} fill="none" strokeLinecap="round" /><Path d="M14 40 L6 44 L12 36 Z" fill={shade(C.green)} /><Path d="M22 30 L16 14 L30 24 Z" fill={shade(C.green, 0.8)} /><Path d="M36 32 L34 14 L46 28 Z" fill={shade(C.green, 0.8)} /><Ellipse cx={56} cy={28} rx={8} ry={6} fill={C.green} /><Polygon points="52,22 50,14 56,22" fill={C.yellow} /><Polygon points="58,22 60,14 62,22" fill={C.yellow} /><Eye x={58} y={27} /><Path d="M62 31 Q 66 33 62 35" stroke={C.red} strokeWidth={1.5} fill="none" /><Circle cx={66} cy={33} r={2} fill={C.orange} /></>;
    default: return <Circle cx={32} cy={32} r={12} fill={C.gray} />;
  }
}

export const SNAIL_SHAPES = (
  <>
    <Path d="M12 48 Q 30 52 48 48 Q 40 40 30 40 Q 18 40 12 48 Z" fill={C.sand} />
    <Circle cx={36} cy={34} r={13} fill={C.orange} />
    <Path d="M36 34 m-8 0 a8 8 0 1 1 16 0 a5 5 0 1 0 -10 0 a2 2 0 1 1 4 0" stroke={shade(C.orange)} strokeWidth={2.5} fill="none" />
    <Line x1={16} y1={42} x2={12} y2={30} stroke={C.sand} strokeWidth={3} strokeLinecap="round" />
    <Line x1={20} y1={42} x2={18} y2={30} stroke={C.sand} strokeWidth={3} strokeLinecap="round" />
    <Circle cx={12} cy={29} r={2} fill={C.dark} /><Circle cx={18} cy={29} r={2} fill={C.dark} />
  </>
);
export const SUNK_SHAPES = (
  <>
    <Path d="M4 40 Q 12 34 20 40 T 36 40 T 52 40 T 64 40 L 64 60 L 4 60 Z" fill={C.sky} opacity={0.9} />
    <Rect x={22} y={24} width={20} height={14} rx={2} fill={C.cream} transform="rotate(-12 32 31)" />
    <Path d="M22 24 L32 32 L42 24" stroke={C.orange} strokeWidth={1.5} fill="none" transform="rotate(-12 32 31)" />
    <Circle cx={46} cy={30} r={2} fill={C.white} opacity={0.8} /><Circle cx={50} cy={24} r={3} fill={C.white} opacity={0.6} />
  </>
);

/** SVG 안에서 쓰는 도형 묶음 (64×64 좌표계) */
export function ArtShapes({ id, snail, sunk }: { id: VehicleId; snail?: boolean; sunk?: boolean }) {
  if (sunk) return <>{SUNK_SHAPES}</>;
  if (snail) return <>{SNAIL_SHAPES}</>;
  return <>{shapes(id)}</>;
}

/** 지구(SVG) 마커용: 중심 (x,y), 크기 size, 오른쪽 기준 회전 headingDeg(화면 시계방향) — 왼쪽으로 갈 땐 좌우 반전 */
export function GlobeArt({ id, x, y, size, headingDeg = 90, snail, sunk }: { id: VehicleId; x: number; y: number; size: number; headingDeg?: number; snail?: boolean; sunk?: boolean }) {
  const s = size / 64;
  const goingLeft = ((headingDeg % 360) + 360) % 360 > 180; // 화면 기준 서쪽
  const tilt = Math.max(-25, Math.min(25, (((headingDeg + 270) % 360) - 180) * 0.15));
  return (
    <G transform={`translate(${x} ${y}) rotate(${goingLeft ? -tilt : tilt}) scale(${goingLeft ? -s : s} ${s}) translate(-32 -32)`}>
      <ArtShapes id={id} snail={snail} sunk={sunk} />
    </G>
  );
}

/** 일반 뷰용 아이콘 */
export function VehicleArt({ id, size = 40, bubble = false, ring, snail, sunk }: { id: VehicleId; size?: number; bubble?: boolean; ring?: string; snail?: boolean; sunk?: boolean }) {
  const inner = <Svg width={bubble ? size * 0.72 : size} height={bubble ? size * 0.72 : size} viewBox="0 0 64 64"><ArtShapes id={id} snail={snail} sunk={sunk} /></Svg>;
  if (!bubble) return inner;
  return (
    <View style={[{ width: size, height: size, borderRadius: size, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2.5 : 0, borderColor: ring ?? '#fff' }, shadow.bubble]}>
      {inner}
    </View>
  );
}
