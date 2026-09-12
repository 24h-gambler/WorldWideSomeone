/**
 * 지구 v2 — Zenly 감성: 밝은 하늘색 바다, 파스텔 민트 육지, 흰 테두리 버블 마커(아바타/운송수단), 진한 그림자.
 * SVG 정사영(orthographic) 투영. iOS/Android/Web 동일 렌더.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { geoDistance, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';

import type { LatLng, Letter } from '@/types';
import { LAND } from '@/engine/geo';
import { pathSamples, positionOf, progressOf } from '@/engine/sim';
import { SNAIL, VEHICLE_MAP } from '@/data/vehicles';
import { colors } from '@/theme';
import { ME_ID } from '@/store';

export type GlobeFriend = { id: string; avatar: string; location: LatLng };

type Props = {
  size: number;
  letters: Letter[];
  me?: LatLng | null;
  meAvatar?: string;
  friends?: GlobeFriend[];
  focusLetterId?: string | null;
  focusPoint?: LatLng | null;
  pickedPoints?: LatLng[];
  onSelectLetter?: (id: string | null) => void;
  onSelectPoint?: (p: LatLng) => void;
  interactive?: boolean;
  autoRotate?: boolean;
  fps?: number;
  zoom?: number; // 1 = 기본
};

function lerpAngle(a: number, b: number, t: number) {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

export function Globe({ size, letters, me, meAvatar = '🙂', friends = [], focusLetterId, focusPoint, pickedPoints = [], onSelectLetter, onSelectPoint, interactive = true, autoRotate = true, fps = 30, zoom = 1 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44 * zoom;
  // 웹: 스택에 숨겨진 다른 화면의 지구와 그라데이션 id 가 충돌하면 채움이 사라짐 → 인스턴스별 고유 id
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ID = { halo: `halo${gid}`, ocean: `ocean${gid}`, rim: `rim${gid}`, land: `land${gid}`, me: `me${gid}` };

  const rot = useRef<[number, number]>([me ? -me.lng : -127, me ? -Math.min(45, Math.max(-45, me.lat)) * 0.6 : -20]);
  const idleUntil = useRef(0);
  const [, setFrame] = useState(0);
  const now = Date.now();
  const lastFocusPoint = useRef<LatLng | null>(null);
  const lettersRef = useRef(letters);
  lettersRef.current = letters;

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      let target: LatLng | null = null;
      if (focusLetterId) {
        const l = lettersRef.current.find((x) => x.id === focusLetterId);
        if (l) target = positionOf(l, t);
      } else if (focusPoint && focusPoint !== lastFocusPoint.current) target = focusPoint;
      if (target) {
        const [lam, phi] = rot.current;
        const nl = lerpAngle(lam, -target.lng, 0.12);
        const np = phi + (-target.lat - phi) * 0.12;
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
  const project = (p: LatLng): [number, number] | null => {
    if (!visible(p)) return null;
    const xy = projection([p.lng, p.lat]);
    return xy ? [xy[0], xy[1]] : null;
  };
  const depth = (p: LatLng) => 1 - geoDistance([p.lng, p.lat], center) / (Math.PI / 2); // 1 중심 → 0 가장자리

  const shown = letters.filter((l) => l.status === 'flying' || l.status === 'landed');
  const markers: { id: string; x: number; y: number }[] = [];

  const handleTap = useCallback(
    (x: number, y: number) => {
      let best: { id: string; d: number } | null = null;
      for (const m of markers) {
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < 26 && (!best || d < best.d)) best = { id: m.id, d };
      }
      if (best) return onSelectLetter?.(best.id);
      if (Math.hypot(x - cx, y - cy) <= r) {
        const inv = projection.invert?.([x, y]);
        if (inv && onSelectPoint) onSelectPoint({ lat: inv[1], lng: inv[0] });
        else onSelectLetter?.(null);
      } else onSelectLetter?.(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectLetter, onSelectPoint, projection, cx, cy, r],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: (_, g) => interactive && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderGrant: () => { idleUntil.current = Date.now() + 4000; },
        onPanResponderMove: (_, g) => {
          const k = 90 / r;
          const [lam, phi] = rot.current;
          rot.current = [lam + g.dx * k * 0.35, Math.max(-85, Math.min(85, phi - g.dy * k * 0.35))];
          idleUntil.current = Date.now() + 4000;
          setFrame((f) => f + 1);
        },
        onPanResponderRelease: (e, g) => {
          idleUntil.current = Date.now() + 5000;
          if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
      }),
    [interactive, r, handleTap],
  );

  /** 흰 테두리 버블 (Zenly) */
  const Bubble = ({ x, y, size: bs, ring, children, shadow = true }: { x: number; y: number; size: number; ring?: string; children: React.ReactNode; shadow?: boolean }) => (
    <G>
      {shadow && <Circle cx={x} cy={y + bs * 0.18} r={bs * 0.55} fill="#0B3D91" opacity={0.18} />}
      {ring ? <Circle cx={x} cy={y} r={bs * 0.62} fill={ring} /> : null}
      <Circle cx={x} cy={y} r={bs * 0.55} fill="#fff" />
      {children}
    </G>
  );

  return (
    <View style={{ width: size, height: size }} {...pan.panHandlers}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={ID.halo} cx="50%" cy="50%" r="50%">
            <Stop offset="0.86" stopColor="#7DBBFF" stopOpacity={0} />
            <Stop offset="0.93" stopColor="#7DBBFF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#7DBBFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={ID.ocean} cx="40%" cy="34%" r="72%">
            <Stop offset="0" stopColor="#E3F4FF" />
            <Stop offset="0.6" stopColor={colors.ocean} />
            <Stop offset="1" stopColor={colors.oceanDeep} />
          </RadialGradient>
          <RadialGradient id={ID.rim} cx="42%" cy="36%" r="68%">
            <Stop offset="0.75" stopColor="#1B5FBF" stopOpacity={0} />
            <Stop offset="1" stopColor="#1B5FBF" stopOpacity={0.28} />
          </RadialGradient>
          <LinearGradient id={ID.land} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D2F5C4" />
            <Stop offset="1" stopColor={colors.landDark} />
          </LinearGradient>
          <RadialGradient id={ID.me} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.blue} stopOpacity={0.45} />
            <Stop offset="1" stopColor={colors.blue} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={cx} cy={cy} r={r * 1.16} fill={`url(#${ID.halo})`} />
        <Circle cx={cx + 4} cy={cy + 10} r={r} fill="#0B3D91" opacity={0.12} />
        <Circle cx={cx} cy={cy} r={r} fill={`url(#${ID.ocean})`} />
        <Path d={graticuleD} stroke={colors.graticule} strokeWidth={0.8} fill="none" />
        <Path d={landD} fill={`url(#${ID.land})`} stroke={colors.landLine} strokeWidth={0.9} strokeLinejoin="round" />
        <Circle cx={cx} cy={cy} r={r} fill={`url(#${ID.rim})`} />
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={2.5} />

        {/* 비행 아크 */}
        {shown.map((l) => {
          const v = VEHICLE_MAP[l.vehicle];
          const p = progressOf(l, now);
          const samples = pathSamples(l, 64);
          const full = path({ type: 'LineString', coordinates: samples.map((q) => [q.lng, q.lat]) } as any) ?? '';
          const upto = Math.max(2, Math.round(samples.length * p));
          const doneD = path({ type: 'LineString', coordinates: samples.slice(0, upto).map((q) => [q.lng, q.lat]) } as any) ?? '';
          const isFocus = focusLetterId === l.id;
          const mine = l.senderId === ME_ID || l.recipientId === ME_ID;
          const c = mine ? colors.pink : v.color;
          return (
            <G key={l.id} opacity={isFocus || !focusLetterId ? 1 : 0.3}>
              <Path d={full} stroke="#fff" strokeOpacity={0.9} strokeWidth={isFocus ? 4 : 3} fill="none" strokeLinecap="round" />
              <Path d={full} stroke={c} strokeOpacity={0.35} strokeWidth={isFocus ? 2.4 : 1.6} strokeDasharray="4 5" fill="none" strokeLinecap="round" />
              <Path d={doneD} stroke={c} strokeOpacity={0.95} strokeWidth={isFocus ? 3 : 2} fill="none" strokeLinecap="round" />
            </G>
          );
        })}

        {/* 경유지 (경로 지정 / 경로 변경) */}
        {(() => {
          const waypointLetter = shown.find((l) => l.id === focusLetterId && l.waypoints.length > 0);
          if (!waypointLetter) return null;
          return waypointLetter.waypoints.slice(1).map((w, i) => {
            const xy = project(w);
            if (!xy) return null;
            return <Circle key={`wp${i}`} cx={xy[0]} cy={xy[1]} r={4} fill={colors.yellow} stroke="#fff" strokeWidth={1.5} />;
          });
        })()}

        {/* 목적지 */}
        {shown.map((l) => {
          const xy = project(l.destination);
          if (!xy) return null;
          const mine = l.senderId === ME_ID;
          return (
            <G key={`d-${l.id}`}>
              {l.status === 'landed' && <Circle cx={xy[0]} cy={xy[1]} r={8 + (now % 1200) / 150} stroke={colors.yellow} strokeWidth={1.5} fill="none" opacity={0.8} />}
              <Circle cx={xy[0]} cy={xy[1]} r={4} fill={mine ? colors.pink : VEHICLE_MAP[l.vehicle].color} stroke="#fff" strokeWidth={1.5} />
            </G>
          );
        })}

        {/* 친구 (50km 흐림 원 + 아바타 버블) */}
        {friends.map((f) => {
          const xy = project(f.location);
          if (!xy) return null;
          return (
            <G key={f.id}>
              <Circle cx={xy[0]} cy={xy[1]} r={16} fill={colors.blue} fillOpacity={0.12} stroke={colors.blue} strokeOpacity={0.35} strokeWidth={1} />
              <Bubble x={xy[0]} y={xy[1]} size={26} ring={colors.pink}>
                <SvgText x={xy[0]} y={xy[1] + 5} fontSize={14} textAnchor="middle">{f.avatar}</SvgText>
              </Bubble>
            </G>
          );
        })}

        {/* 지정 위치들 */}
        {pickedPoints.map((p, i) => {
          const xy = project(p);
          if (!xy) return null;
          return (
            <G key={`pp${i}`}>
              <Circle cx={xy[0]} cy={xy[1] + 3} r={7} fill="#0B3D91" opacity={0.18} />
              <Circle cx={xy[0]} cy={xy[1]} r={9} fill={colors.yellow} stroke="#fff" strokeWidth={2} />
              <SvgText x={xy[0]} y={xy[1] + 3.5} fontSize={10} fontWeight="700" fill="#4A3A00" textAnchor="middle">{i + 1}</SvgText>
            </G>
          );
        })}

        {/* 나 */}
        {me && (() => {
          const xy = project(me);
          if (!xy) return null;
          const pulse = 14 + ((now % 1600) / 1600) * 16;
          return (
            <G>
              <Circle cx={xy[0]} cy={xy[1]} r={pulse} fill={`url(#${ID.me})`} />
              <Bubble x={xy[0]} y={xy[1]} size={30} ring={colors.blue}>
                <SvgText x={xy[0]} y={xy[1] + 6} fontSize={16} textAnchor="middle">{meAvatar}</SvgText>
              </Bubble>
            </G>
          );
        })()}

        {/* 비행 물체 버블 */}
        {shown
          .filter((l) => l.status === 'flying')
          .map((l) => ({ l, pos: positionOf(l, now) }))
          .sort((a, b) => depth(a.pos) - depth(b.pos))
          .map(({ l, pos }) => {
            const xy = project(pos);
            if (!xy) return null;
            markers.push({ id: l.id, x: xy[0], y: xy[1] });
            const v = VEHICLE_MAP[l.vehicle];
            const isFocus = focusLetterId === l.id;
            const mine = l.senderId === ME_ID || l.recipientId === ME_ID;
            const snail = !!l.penalty && now < l.penalty.until;
            const bs = isFocus ? 40 : 28;
            const bob = Math.sin(now / 260 + l.id.charCodeAt(0)) * 1.5;
            return (
              <G key={`o-${l.id}`} opacity={!focusLetterId || isFocus ? 1 : 0.55}>
                <Bubble x={xy[0]} y={xy[1] + bob} size={bs} ring={isFocus ? (mine ? colors.pink : v.color) : undefined}>
                  <SvgText x={xy[0]} y={xy[1] + bob + bs * 0.2} fontSize={bs * 0.55} textAnchor="middle">{snail ? SNAIL.emoji : v.emoji}</SvgText>
                </Bubble>
                {l.shield && <Circle cx={xy[0] + bs * 0.4} cy={xy[1] + bob - bs * 0.4} r={6} fill="#fff" stroke={colors.blue} strokeWidth={1.5} />}
                {l.shield && <SvgText x={xy[0] + bs * 0.4} y={xy[1] + bob - bs * 0.4 + 3} fontSize={7} textAnchor="middle">🛡️</SvgText>}
              </G>
            );
          })}
      </Svg>
    </View>
  );
}

export default Globe;
