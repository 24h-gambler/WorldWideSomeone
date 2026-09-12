/**
 * 지구 — SVG 정사영(orthographic) 투영. GL 없이 iOS/Android/Web 동일 렌더.
 * 레이어: 별 → 대기광 → 바다 → 격자 → 대륙 → 림 셰이딩 → 비행 아크 → 마커(착륙/친구/나/물체)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { geoDistance, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';

import type { LatLng, Letter } from '@/types';
import { LAND } from '@/engine/geo';
import { pathSamples, positionOf, progressOf } from '@/engine/sim';
import { VEHICLE_MAP } from '@/data/vehicles';
import { colors } from '@/theme';
import { ME_ID } from '@/store';
import { GlobeVehicleGlyph } from '@/components/vehicle-icon';

export type GlobeFriend = { id: string; avatar: string; location: LatLng };

type Props = {
  size: number;
  letters: Letter[];
  me?: LatLng | null;
  friends?: GlobeFriend[];
  focusLetterId?: string | null;
  focusPoint?: LatLng | null; // 지정 위치로 카메라 이동(1회)
  pickedPoint?: LatLng | null;
  onSelectLetter?: (id: string | null) => void;
  onSelectPoint?: (p: LatLng) => void;
  interactive?: boolean;
  autoRotate?: boolean;
  fps?: number;
  dim?: boolean; // 배경용(온보딩 등) 저대비
  showStars?: boolean;
};

const RAD = Math.PI / 180;

function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

export function Globe({
  size,
  letters,
  me,
  friends = [],
  focusLetterId,
  focusPoint,
  pickedPoint,
  onSelectLetter,
  onSelectPoint,
  interactive = true,
  autoRotate = true,
  fps = 30,
  dim = false,
  showStars = true,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  // 회전 상태는 ref에 두고, 프레임 카운터로 리렌더
  const rot = useRef<[number, number]>([me ? -me.lng : -127, me ? -Math.min(50, Math.max(-50, me.lat)) * 0.6 : -20]);
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
      } else if (focusPoint && focusPoint !== lastFocusPoint.current) {
        target = focusPoint;
      }
      if (target) {
        const [lam, phi] = rot.current;
        const nl = lerpAngle(lam, -target.lng, 0.12);
        const np = phi + (-target.lat - phi) * 0.12;
        rot.current = [nl, Math.max(-85, Math.min(85, np))];
        if (focusPoint && Math.abs(nl - -target.lng) < 0.3 && Math.abs(np - -target.lat) < 0.3) {
          lastFocusPoint.current = focusPoint;
        }
      } else if (autoRotate && t > idleUntil.current) {
        rot.current = [rot.current[0] + 0.05 * (30 / fps) * 2, rot.current[1]];
      }
      setFrame((f) => (f + 1) % 1_000_000);
    }, Math.round(1000 / fps));
    return () => clearInterval(id);
  }, [autoRotate, focusLetterId, focusPoint, fps]);

  const projection = useMemo(
    () => geoOrthographic().translate([cx, cy]).scale(r).clipAngle(90).precision(0.6),
    [cx, cy, r],
  );
  projection.rotate([rot.current[0], rot.current[1], 0]);
  const path = geoPath(projection);

  const landD = path(LAND) ?? '';
  const graticuleD = useMemo(() => path(geoGraticule().step([30, 30])()) ?? '', [path, rot.current[0], rot.current[1]]);

  const center: [number, number] = [-rot.current[0], -rot.current[1]];
  const visible = (p: LatLng) => geoDistance([p.lng, p.lat], center) < Math.PI / 2 - 0.02;
  const project = (p: LatLng): [number, number] | null => {
    if (!visible(p)) return null;
    const xy = projection([p.lng, p.lat]);
    return xy ? [xy[0], xy[1]] : null;
  };

  // 별 (고정)
  const stars = useMemo(() => {
    const out: { x: number; y: number; s: number; o: number }[] = [];
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      if (Math.hypot(x - cx, y - cy) < r * 1.12) continue;
      out.push({ x, y, s: 0.6 + rnd() * 1.4, o: 0.25 + rnd() * 0.6 });
    }
    return out;
  }, [size, cx, cy, r]);

  // 활성 편지 (비행/착륙)
  const shown = letters.filter((l) => l.status === 'flying' || l.status === 'landed');

  const markers: { id: string; x: number; y: number }[] = [];

  const handleTap = useCallback(
    (x: number, y: number) => {
      // 가장 가까운 물체 마커
      let best: { id: string; d: number } | null = null;
      for (const m of markers) {
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < 26 && (!best || d < best.d)) best = { id: m.id, d };
      }
      if (best) {
        onSelectLetter?.(best.id);
        return;
      }
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
        onPanResponderGrant: () => {
          idleUntil.current = Date.now() + 4000;
        },
        onPanResponderMove: (_, g) => {
          const k = 90 / r; // 픽셀 → 도
          const [lam, phi] = rot.current;
          rot.current = [lam + g.dx * k * 0.35, Math.max(-85, Math.min(85, phi - g.dy * k * 0.35))];
          idleUntil.current = Date.now() + 4000;
          setFrame((f) => f + 1);
        },
        onPanResponderRelease: (e, g) => {
          idleUntil.current = Date.now() + 5000;
          if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) {
            handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY);
          }
        },
      }),
    [interactive, r, handleTap],
  );

  const landOpacity = dim ? 0.55 : 1;

  return (
    <View style={{ width: size, height: size }} {...pan.panHandlers}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="atmo" cx="50%" cy="50%" r="50%">
            <Stop offset="0.80" stopColor={colors.atmosphere} stopOpacity={0} />
            <Stop offset="0.88" stopColor={colors.atmosphere} stopOpacity={dim ? 0.18 : 0.35} />
            <Stop offset="1" stopColor={colors.atmosphere} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ocean" cx="38%" cy="32%" r="75%">
            <Stop offset="0" stopColor="#1B3F8F" />
            <Stop offset="0.55" stopColor={colors.ocean} />
            <Stop offset="1" stopColor={colors.oceanDeep} />
          </RadialGradient>
          <RadialGradient id="rim" cx="40%" cy="35%" r="70%">
            <Stop offset="0.7" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.55} />
          </RadialGradient>
          <LinearGradient id="landg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#3BC9A8" />
            <Stop offset="1" stopColor={colors.landDark} />
          </LinearGradient>
          <RadialGradient id="mepulse" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.6} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {showStars &&
          stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o * (dim ? 0.5 : 1)} />)}

        {/* 대기광 */}
        <Circle cx={cx} cy={cy} r={r * 1.2} fill="url(#atmo)" />
        {/* 바다 */}
        <Circle cx={cx} cy={cy} r={r} fill="url(#ocean)" />
        {/* 격자 */}
        <Path d={graticuleD} stroke="rgba(255,255,255,0.06)" strokeWidth={0.8} fill="none" />
        {/* 대륙 */}
        <Path d={landD} fill="url(#landg)" opacity={landOpacity} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} />
        {/* 림 셰이딩 */}
        <Circle cx={cx} cy={cy} r={r} fill="url(#rim)" />
        {/* 테두리 */}
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(160,190,255,0.35)" strokeWidth={1} />

        {/* 비행 아크 */}
        <G>
          {shown.map((l) => {
            const v = VEHICLE_MAP[l.vehicle];
            const p = progressOf(l, now);
            const samples = pathSamples(l, 64);
            const full = path({ type: 'LineString', coordinates: samples.map((q) => [q.lng, q.lat]) } as any) ?? '';
            const upto = Math.max(2, Math.round(samples.length * p));
            const doneD = path({ type: 'LineString', coordinates: samples.slice(0, upto).map((q) => [q.lng, q.lat]) } as any) ?? '';
            const isFocus = focusLetterId === l.id;
            const mine = l.senderId === ME_ID;
            const baseColor = mine ? colors.accent : v.color;
            return (
              <G key={l.id} opacity={isFocus || !focusLetterId ? 1 : 0.35}>
                <Path d={full} stroke={baseColor} strokeOpacity={0.22} strokeWidth={isFocus ? 1.6 : 1} strokeDasharray="3 5" fill="none" />
                <Path d={doneD} stroke={baseColor} strokeOpacity={0.9} strokeWidth={isFocus ? 2.4 : 1.6} fill="none" strokeLinecap="round" />
              </G>
            );
          })}
        </G>

        {/* 착륙 지점 / 목적지 핀 */}
        {shown.map((l) => {
          const xy = project(l.destination);
          if (!xy) return null;
          const mine = l.senderId === ME_ID;
          return (
            <G key={`d-${l.id}`}>
              <Circle cx={xy[0]} cy={xy[1]} r={3} fill={mine ? colors.accent : 'rgba(255,255,255,0.7)'} />
              {l.status === 'landed' && <Circle cx={xy[0]} cy={xy[1]} r={7 + (now % 1200) / 200} stroke={colors.gold} strokeOpacity={0.6} fill="none" />}
            </G>
          );
        })}

        {/* 친구 (50km 흐림) */}
        {friends.map((f) => {
          const xy = project(f.location);
          if (!xy) return null;
          return (
            <G key={f.id}>
              <Circle cx={xy[0]} cy={xy[1]} r={13} fill={colors.sky} fillOpacity={0.18} stroke={colors.sky} strokeOpacity={0.5} strokeWidth={1} />
              <SvgText x={xy[0]} y={xy[1] + 4.5} fontSize={12} textAnchor="middle">
                {f.avatar}
              </SvgText>
            </G>
          );
        })}

        {/* 나 */}
        {me &&
          (() => {
            const xy = project(me);
            if (!xy) return null;
            const pulse = 10 + ((now % 1600) / 1600) * 14;
            return (
              <G>
                <Circle cx={xy[0]} cy={xy[1]} r={pulse} fill="url(#mepulse)" />
                <Circle cx={xy[0]} cy={xy[1]} r={5} fill={colors.accent} stroke="#fff" strokeWidth={2} />
              </G>
            );
          })()}

        {/* 지정 위치 */}
        {pickedPoint &&
          (() => {
            const xy = project(pickedPoint);
            if (!xy) return null;
            return (
              <G>
                <Circle cx={xy[0]} cy={xy[1]} r={9} fill="none" stroke={colors.gold} strokeWidth={2} />
                <Circle cx={xy[0]} cy={xy[1]} r={3} fill={colors.gold} />
                <SvgText x={xy[0]} y={xy[1] - 14} fontSize={16} textAnchor="middle">
                  📍
                </SvgText>
              </G>
            );
          })()}

        {/* 비행 물체 */}
        {shown.map((l) => {
          if (l.status !== 'flying') return null;
          const pos = positionOf(l, now);
          const xy = project(pos);
          if (!xy) return null;
          markers.push({ id: l.id, x: xy[0], y: xy[1] });
          const v = VEHICLE_MAP[l.vehicle];
          const isFocus = focusLetterId === l.id;
          const mine = l.senderId === ME_ID;
          const fs = isFocus ? 26 : 18;
          const bob = Math.sin(now / 260 + l.id.charCodeAt(0)) * 1.5;
          return (
            <G key={`o-${l.id}`}>
              <Circle cx={xy[0]} cy={xy[1]} r={isFocus ? 18 : 12} fill={mine ? colors.accent : v.color} fillOpacity={isFocus ? 0.3 : 0.16} />
              {l.shield && <Circle cx={xy[0]} cy={xy[1]} r={isFocus ? 21 : 15} stroke={colors.sky} strokeWidth={1.5} strokeDasharray="2 3" fill="none" />}
              {l.vehicle === 'paper' ? (
                (() => {
                  const ahead = project(positionOf(l, now + 30_000));
                  const hd = ahead ? (Math.atan2(ahead[1] - xy[1], ahead[0] - xy[0]) * 180) / Math.PI + 90 : 0;
                  return <GlobeVehicleGlyph id="paper" x={xy[0]} y={xy[1] + bob} size={fs * 1.1} headingDeg={hd} />;
                })()
              ) : (
                <SvgText x={xy[0]} y={xy[1] + fs * 0.36 + bob} fontSize={fs} textAnchor="middle">
                  {v.emoji}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export default Globe;

export const globeStyles = StyleSheet.create({});
