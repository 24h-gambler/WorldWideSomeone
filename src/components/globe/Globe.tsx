/**
 * 지구 v3 — 경로는 기본 숨김. 탭한 편지만 지나온 길(실선) + 남은 길(점선) + 침수/경로변경 지점을 보여준다.
 * 자체 디자인 아이콘이 진행 방향으로 기울어져 움직인다. 라이트/다크 팔레트.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { geoDistance, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';

import type { LatLng, Letter } from '@/types';
import { LAND } from '@/engine/geo';
import { pastPath, positionOf, remainingPath } from '@/engine/sim';
import { VEHICLE_MAP } from '@/data/vehicles';
import { useColors } from '@/theme';
import { ME_ID } from '@/store';
import { GlobeArt } from '@/components/vehicle-art';

export type GlobeFriend = { id: string; avatar: string; location: LatLng };
type Props = {
  size: number; letters: Letter[]; me?: LatLng | null; meAvatar?: string; friends?: GlobeFriend[];
  focusLetterId?: string | null; focusPoint?: LatLng | null; pickedPoints?: LatLng[];
  onSelectLetter?: (id: string | null) => void; onSelectPoint?: (p: LatLng) => void;
  interactive?: boolean; autoRotate?: boolean; fps?: number; zoom?: number; showRoutes?: 'focus' | 'all' | 'none';
};
const lerpAngle = (a: number, b: number, t: number) => a + (((b - a + 540) % 360) - 180) * t;

export function Globe({ size, letters, me, meAvatar = '🙂', friends = [], focusLetterId, focusPoint, pickedPoints = [], onSelectLetter, onSelectPoint, interactive = true, autoRotate = true, fps = 30, zoom = 1, showRoutes = 'focus' }: Props) {
  const c = useColors();
  const cx = size / 2, cy = size / 2, r = size * 0.44 * zoom;
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ID = { halo: `halo${gid}`, ocean: `ocean${gid}`, rim: `rim${gid}`, land: `land${gid}`, me: `me${gid}` };
  const rot = useRef<[number, number]>([me ? -me.lng : -127, me ? -Math.min(45, Math.max(-45, me.lat)) * 0.6 : -20]);
  const idleUntil = useRef(0);
  const [, setFrame] = useState(0);
  const now = Date.now();
  const lastFocusPoint = useRef<LatLng | null>(null);
  const lettersRef = useRef(letters); lettersRef.current = letters;

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      let target: LatLng | null = null;
      if (focusLetterId) { const l = lettersRef.current.find((x) => x.id === focusLetterId); if (l) target = positionOf(l, t); }
      else if (focusPoint && focusPoint !== lastFocusPoint.current) target = focusPoint;
      if (target) {
        const [lam, phi] = rot.current;
        const nl = lerpAngle(lam, -target.lng, 0.12), np = phi + (-target.lat - phi) * 0.12;
        rot.current = [nl, Math.max(-85, Math.min(85, np))];
        if (focusPoint && Math.abs(nl - -target.lng) < 0.3 && Math.abs(np - -target.lat) < 0.3) lastFocusPoint.current = focusPoint;
      } else if (autoRotate && t > idleUntil.current) rot.current = [rot.current[0] + 0.1 * (30 / fps), rot.current[1]];
      setFrame((f) => (f + 1) % 1_000_000);
    }, Math.round(1000 / fps));
    return () => clearInterval(id);
  }, [autoRotate, focusLetterId, focusPoint, fps]);

  const projection = useMemo(() => geoOrthographic().translate([cx, cy]).scale(r).clipAngle(90).precision(0.6), [cx, cy, r]);
  projection.rotate([rot.current[0], rot.current[1], 0]);
  const path = geoPath(projection);
  const landD = path(LAND) ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graticuleD = useMemo(() => path(geoGraticule().step([20, 20])()) ?? '', [path, rot.current[0], rot.current[1]]);
  const center: [number, number] = [-rot.current[0], -rot.current[1]];
  const visible = (p: LatLng) => geoDistance([p.lng, p.lat], center) < Math.PI / 2 - 0.02;
  const project = (p: LatLng): [number, number] | null => { if (!visible(p)) return null; const xy = projection([p.lng, p.lat]); return xy ? [xy[0], xy[1]] : null; };
  const depth = (p: LatLng) => 1 - geoDistance([p.lng, p.lat], center) / (Math.PI / 2);
  const lineD = (pts: LatLng[]) => path({ type: 'LineString', coordinates: pts.map((q) => [q.lng, q.lat]) } as any) ?? '';

  const shown = letters.filter((l) => l.status === 'flying' || l.status === 'landed' || l.status === 'sunk');
  const markers: { id: string; x: number; y: number }[] = [];
  const handleTap = useCallback((x: number, y: number) => {
    let best: { id: string; d: number } | null = null;
    for (const m of markers) { const d = Math.hypot(m.x - x, m.y - y); if (d < 26 && (!best || d < best.d)) best = { id: m.id, d }; }
    if (best) return onSelectLetter?.(best.id);
    if (Math.hypot(x - cx, y - cy) <= r) { const inv = projection.invert?.([x, y]); if (inv && onSelectPoint) onSelectPoint({ lat: inv[1], lng: inv[0] }); else onSelectLetter?.(null); } else onSelectLetter?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelectLetter, onSelectPoint, projection, cx, cy, r]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => interactive,
    onMoveShouldSetPanResponder: (_, g) => interactive && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
    onPanResponderGrant: () => { idleUntil.current = Date.now() + 4000; },
    onPanResponderMove: (_, g) => { const k = 90 / r; const [lam, phi] = rot.current; rot.current = [lam + g.dx * k * 0.35, Math.max(-85, Math.min(85, phi - g.dy * k * 0.35))]; idleUntil.current = Date.now() + 4000; setFrame((f) => f + 1); },
    onPanResponderRelease: (e, g) => { idleUntil.current = Date.now() + 5000; if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY); },
  }), [interactive, r, handleTap]);

  const Bubble = ({ x, y, size: bs, ring, children }: { x: number; y: number; size: number; ring?: string; children: React.ReactNode }) => (
    <G>
      <Circle cx={x} cy={y + bs * 0.18} r={bs * 0.55} fill={c.bubbleShadow} opacity={c.scheme === 'dark' ? 0.5 : 0.18} />
      {ring ? <Circle cx={x} cy={y} r={bs * 0.62} fill={ring} /> : null}
      <Circle cx={x} cy={y} r={bs * 0.55} fill="#FFFFFF" />
      {children}
    </G>
  );
  const focus = focusLetterId ? shown.find((l) => l.id === focusLetterId) : null;

  return (
    <View style={{ width: size, height: size }} {...pan.panHandlers}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={ID.halo} cx="50%" cy="50%" r="50%"><Stop offset="0.86" stopColor={c.halo} stopOpacity={0} /><Stop offset="0.93" stopColor={c.halo} stopOpacity={0.35} /><Stop offset="1" stopColor={c.halo} stopOpacity={0} /></RadialGradient>
          <RadialGradient id={ID.ocean} cx="40%" cy="34%" r="72%"><Stop offset="0" stopColor={c.oceanLight} /><Stop offset="0.6" stopColor={c.ocean} /><Stop offset="1" stopColor={c.oceanDeep} /></RadialGradient>
          <RadialGradient id={ID.rim} cx="42%" cy="36%" r="68%"><Stop offset="0.75" stopColor={c.rim} stopOpacity={0} /><Stop offset="1" stopColor={c.rim} stopOpacity={c.scheme === 'dark' ? 0.55 : 0.28} /></RadialGradient>
          <LinearGradient id={ID.land} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.land} /><Stop offset="1" stopColor={c.landDark} /></LinearGradient>
          <RadialGradient id={ID.me} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={c.blue} stopOpacity={0.45} /><Stop offset="1" stopColor={c.blue} stopOpacity={0} /></RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={r * 1.16} fill={`url(#${ID.halo})`} />
        <Circle cx={cx + 4} cy={cy + 10} r={r} fill={c.bubbleShadow} opacity={c.scheme === 'dark' ? 0.4 : 0.12} />
        <Circle cx={cx} cy={cy} r={r} fill={`url(#${ID.ocean})`} />
        <Path d={graticuleD} stroke={c.graticule} strokeWidth={0.7} fill="none" />
        {/* 육지: 윤곽선 대신 부드러운 내부 그림자 느낌 (연한 선 + 그라데이션) */}
        <Path d={landD} fill={`url(#${ID.land})`} stroke={c.landLine} strokeWidth={0.6} strokeLinejoin="round" />
        <Circle cx={cx} cy={cy} r={r} fill={`url(#${ID.rim})`} />
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={c.bubble} strokeWidth={2.5} opacity={c.scheme === 'dark' ? 0.5 : 1} />

        {/* 경로: 포커스된 편지만 (또는 all) */}
        {(showRoutes === 'all' ? shown : focus ? [focus] : []).map((l) => {
          const mine = l.senderId === ME_ID || l.recipientId === ME_ID;
          const col = mine ? c.pink : VEHICLE_MAP[l.vehicle].color;
          const past = lineD(pastPath(l, now));
          const rest = l.status === 'flying' ? lineD(remainingPath(l, now)) : '';
          return (
            <G key={`r-${l.id}`}>
              <Path d={past} stroke={c.bubble} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
              <Path d={past} stroke={col} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {rest ? <Path d={rest} stroke={col} strokeOpacity={0.45} strokeWidth={1.8} strokeDasharray="3 5" fill="none" strokeLinecap="round" /> : null}
              {l.events.filter((e) => e.type === 'rerouted' || e.type === 'pulled' || e.type === 'sunk' || e.type === 'resurfaced' || e.type === 'rescued').map((e, i) => {
                const idx = Math.min(l.trail.length - 1, Math.max(0, Math.round(((e.at - l.departedAt) / Math.max(1, now - l.departedAt)) * l.trail.length)));
                const p = l.trail[idx]; if (!p) return null;
                const xy = project(p); if (!xy) return null;
                const glyph = e.type === 'sunk' ? '🌊' : e.type === 'pulled' ? '🧲' : e.type === 'rerouted' ? '🧭' : '⬆️';
                return <G key={i}><Circle cx={xy[0]} cy={xy[1]} r={7} fill={c.bubble} stroke={col} strokeWidth={1.5} /><SvgText x={xy[0]} y={xy[1] + 3} fontSize={8} textAnchor="middle">{glyph}</SvgText></G>;
              })}
              {(() => { const xy = project(l.destination); if (!xy) return null; return <Circle cx={xy[0]} cy={xy[1]} r={5} fill={col} stroke={c.bubble} strokeWidth={2} />; })()}
            </G>
          );
        })}

        {/* 착륙 대기 */}
        {shown.filter((l) => l.status === 'landed').map((l) => { const xy = project(l.destination); if (!xy) return null; const f = l.id === focusLetterId; return <G key={`d-${l.id}`}>{f ? <Circle cx={xy[0]} cy={xy[1]} r={8 + (now % 1200) / 150} stroke={c.yellow} strokeWidth={1.5} fill="none" opacity={0.8} /> : null}<Circle cx={xy[0]} cy={xy[1]} r={f ? 4 : 2.6} fill={c.yellow} stroke="#FFFFFF" strokeWidth={1} opacity={f ? 1 : 0.75} /></G>; })}

        {/* 친구 */}
        {friends.map((f) => { const xy = project(f.location); if (!xy) return null; return (
          <G key={f.id}>
            {/* 젠리식: 친구는 정확한 점이 아니라 50km 반경 원으로 */}
            <Circle cx={xy[0]} cy={xy[1]} r={Math.max(10, r * (50 / 6371) * zoom)} fill={c.blue} fillOpacity={0.14} stroke={c.blue} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 3" />
            <Bubble x={xy[0]} y={xy[1]} size={26} ring={c.pink}><SvgText x={xy[0]} y={xy[1] + 5} fontSize={14} textAnchor="middle">{f.avatar}</SvgText></Bubble>
          </G>
        ); })}
        {pickedPoints.map((p, i) => { const xy = project(p); if (!xy) return null; return (
          <G key={`pp${i}`}><Circle cx={xy[0]} cy={xy[1] + 3} r={7} fill={c.bubbleShadow} opacity={0.18} /><Circle cx={xy[0]} cy={xy[1]} r={9} fill={c.yellow} stroke={c.bubble} strokeWidth={2} /><SvgText x={xy[0]} y={xy[1] + 3.5} fontSize={10} fontWeight="700" fill="#4A3A00" textAnchor="middle">{i + 1}</SvgText></G>
        ); })}
        {me && (() => { const xy = project(me); if (!xy) return null; const pulse = 14 + ((now % 1600) / 1600) * 16; return (
          <G><Circle cx={xy[0]} cy={xy[1]} r={pulse} fill={`url(#${ID.me})`} /><Bubble x={xy[0]} y={xy[1]} size={30} ring={c.blue}><SvgText x={xy[0]} y={xy[1] + 6} fontSize={16} textAnchor="middle">{meAvatar}</SvgText></Bubble></G>
        ); })()}

        {/* 배달원 (자체 아이콘, 진행 방향) */}
        {shown.filter((l) => l.status !== 'landed').map((l) => ({ l, pos: positionOf(l, now) })).sort((a, b) => depth(a.pos) - depth(b.pos)).map(({ l, pos }) => {
          const xy = project(pos); if (!xy) return null;
          markers.push({ id: l.id, x: xy[0], y: xy[1] });
          const v = VEHICLE_MAP[l.vehicle];
          const isFocus = focusLetterId === l.id;
          const mine = l.senderId === ME_ID || l.recipientId === ME_ID;
          const sunk = l.status === 'sunk';
          const snail = !!l.penalty && now < l.penalty.until;
          const bs = isFocus ? 44 : 30;
          const bob = sunk ? Math.sin(now / 500) * 1 : Math.sin(now / 260 + l.id.charCodeAt(0)) * 1.5;
          let heading = 90;
          if (!sunk) { const ahead = project(positionOf(l, now + 20_000)); if (ahead) heading = (Math.atan2(ahead[1] - xy[1], ahead[0] - xy[0]) * 180) / Math.PI; }
          return (
            <G key={`o-${l.id}`} opacity={!focusLetterId || isFocus ? 1 : 0.5}>
              <Bubble x={xy[0]} y={xy[1] + bob} size={bs} ring={isFocus ? (mine ? c.pink : v.color) : mine ? c.pink : undefined}>
                <GlobeArt id={l.vehicle} x={xy[0]} y={xy[1] + bob} size={bs * 0.9} headingDeg={heading} snail={snail} sunk={sunk} />
              </Bubble>
              {l.shield && !sunk && <G><Circle cx={xy[0] + bs * 0.42} cy={xy[1] + bob - bs * 0.42} r={6} fill="#FFFFFF" stroke={c.blue} strokeWidth={1.5} /><SvgText x={xy[0] + bs * 0.42} y={xy[1] + bob - bs * 0.42 + 3} fontSize={7} textAnchor="middle">🛡️</SvgText></G>}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
export default Globe;
