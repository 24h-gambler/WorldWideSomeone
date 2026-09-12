/**
 * 비행 시뮬레이션: 경로 기하, 위치 계산(달팽이 벌칙 포함), 통과 판정, 잡기 창, 경로 변경 연속성, 컨택 가능성.
 * 서버(functions/src/sim.ts)와 동일한 규칙을 유지한다.
 */
import type { LatLng, Letter, VehicleId } from '@/types';
import { SNAIL, VEHICLE_MAP } from '@/data/vehicles';
import { EARTH_RADIUS_KM, bearingDeg, destinationPoint, distanceKm, interpolate } from './geo';

export const PASSBY_RADIUS_KM = 150;
export const LANDED_RADIUS_KM = 150;
export const LANDED_WINDOW_MS = 10 * 60_000;
export const ORBIT_LAPS = 3;

type Segment = { a: LatLng; b: LatLng; km: number; interp: (t: number) => LatLng };
export type Route = { segments: Segment[]; totalKm: number; at: (p: number) => LatLng };

const routeCache = new Map<string, Route>();
const key = (o: LatLng, d: LatLng, w: LatLng[], v: VehicleId) => `${o.lat.toFixed(4)},${o.lng.toFixed(4)}|${d.lat.toFixed(4)},${d.lng.toFixed(4)}|${w.map((x) => `${x.lat.toFixed(3)},${x.lng.toFixed(3)}`).join(';')}|${v}`;

export function buildRoute(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId): Route {
  const k = key(origin, dest, waypoints, vehicle);
  const c = routeCache.get(k);
  if (c) return c;
  const v = VEHICLE_MAP[vehicle];
  const pts = [origin, ...waypoints, dest];
  const segments: Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    segments.push({ a, b, km: Math.max(1, distanceKm(a, b)), interp: interpolate(a, b) });
  }
  let route: Route;
  if (v.motion === 'orbit' && segments.length === 1) {
    const seg = segments[0];
    const totalKm = seg.km + ORBIT_LAPS * 2 * Math.PI * EARTH_RADIUS_KM;
    const ratio = totalKm / seg.km;
    route = { segments, totalKm, at: (p) => seg.interp(Math.min(1, Math.max(0, p)) * ratio) };
  } else {
    const totalKm = segments.reduce((s, x) => s + x.km, 0);
    const base = (p: number): LatLng => {
      let d = Math.min(1, Math.max(0, p)) * totalKm;
      for (const s of segments) {
        if (d <= s.km) return s.interp(d / s.km);
        d -= s.km;
      }
      return segments[segments.length - 1].b;
    };
    if (v.motion === 'zigzag' || v.motion === 'drift') {
      const amp = v.motion === 'zigzag' ? Math.min(420, totalKm * 0.06) : Math.min(160, totalKm * 0.03);
      const freq = v.motion === 'zigzag' ? 6 : 1.5;
      route = {
        segments,
        totalKm,
        at: (p) => {
          const q = Math.min(1, Math.max(0, p));
          const here = base(q);
          if (q <= 0.001 || q >= 0.999) return here;
          const ahead = base(Math.min(1, q + 0.002));
          const off = Math.sin(q * Math.PI * 2 * freq) * amp * Math.sin(q * Math.PI);
          return destinationPoint(here, bearingDeg(here, ahead) + 90, off);
        },
      };
    } else route = { segments, totalKm, at: base };
  }
  if (routeCache.size > 400) routeCache.clear();
  routeCache.set(k, route);
  return route;
}

export const routeOf = (l: Letter) => buildRoute(l.origin, l.destination, l.waypoints, l.vehicle);

export function planFlight(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId, timeScale: number) {
  const route = buildRoute(origin, dest, waypoints, vehicle);
  const simHours = route.totalKm / VEHICLE_MAP[vehicle].speedKmh;
  const durationMs = Math.max(20_000, (simHours * 3_600_000) / timeScale);
  return { distanceKm: route.totalKm, durationMs, simHours };
}

/** 달팽이 벌칙 구간은 90% 느리게 → 유효 경과 시간에서 겹치는 구간의 90%를 뺀다 */
function effectiveElapsed(l: Letter, now: number): number {
  let e = now - l.departedAt;
  if (l.penalty) {
    const a = Math.max(l.penalty.from, l.departedAt);
    const b = Math.min(l.penalty.until, now);
    if (b > a) e -= (b - a) * (1 - SNAIL.factor);
  }
  return e;
}

const STOPPED: Letter['status'][] = ['returned', 'ocean', 'space'];

export function progressOf(l: Letter, now: number): number {
  if (l.status === 'flying') {
    const p = effectiveElapsed(l, now) / Math.max(1, l.arrivesAt - l.departedAt - penaltyExtra(l));
    return Math.min(1, Math.max(0, p));
  }
  if (STOPPED.includes(l.status)) {
    const ev = l.events.find((e) => e.type === 'returned' || e.type === 'ocean' || e.type === 'space');
    if (!ev) return 1;
    const p = effectiveElapsed(l, ev.at) / Math.max(1, l.arrivesAt - l.departedAt - penaltyExtra(l));
    return Math.min(1, Math.max(0, p));
  }
  return 1;
}

/** 벌칙으로 늘어난 총 시간 (arrivesAt에 이미 더해져 있음) */
function penaltyExtra(l: Letter): number {
  if (!l.penalty) return 0;
  return (l.penalty.until - l.penalty.from) * (1 - SNAIL.factor);
}

export const positionOf = (l: Letter, now: number): LatLng => routeOf(l).at(progressOf(l, now));

export function headingOf(l: Letter, now: number): number {
  const p = progressOf(l, now);
  const r = routeOf(l);
  return bearingDeg(r.at(Math.max(0, p - 0.002)), r.at(Math.min(1, p + 0.002)));
}

export function pathSamples(l: Letter, n = 72): LatLng[] {
  const r = routeOf(l);
  const out: LatLng[] = [];
  if (VEHICLE_MAP[l.vehicle].motion === 'orbit') {
    const start = Math.max(0, 1 - (2 * Math.PI * EARTH_RADIUS_KM) / r.totalKm);
    for (let i = 0; i <= n; i++) out.push(r.at(start + (i / n) * (1 - start)));
    return out;
  }
  for (let i = 0; i <= n; i++) out.push(r.at(i / n));
  return out;
}

export function minDistanceBetween(l: Letter, t0: number, t1: number, point: LatLng): number {
  const r = routeOf(l);
  const p0 = progressOf(l, t0);
  const p1 = progressOf(l, t1);
  const steps = Math.min(40, Math.max(1, Math.ceil((Math.abs(p1 - p0) * r.totalKm) / 60)));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) best = Math.min(best, distanceKm(r.at(p0 + ((p1 - p0) * i) / steps), point));
  return best;
}

export const catchWindowMs = (v: VehicleId) => Math.round(75_000 * VEHICLE_MAP[v].catchWindowMultiplier);

/** 지나가던 사람이 경유지를 끼워 넣음: 현재 위치에서 경유지들을 거쳐 원래 목적지로. 진행 연속성 유지. */
export function rerouteThrough(l: Letter, now: number, newWaypoints: LatLng[], timeScale: number): Pick<Letter, 'waypoints' | 'departedAt' | 'arrivesAt' | 'distanceKm' | 'penalty'> {
  const here = positionOf(l, now);
  const v = VEHICLE_MAP[l.vehicle];
  // 새 경로: origin → here → 새 경유지들 → destination (이미 지나온 구간은 origin→here 로 단순화)
  const waypoints = [here, ...newWaypoints];
  const route = buildRoute(l.origin, l.destination, waypoints, l.vehicle);
  const doneKm = distanceKm(l.origin, here);
  const totalMs = Math.max(20_000, ((route.totalKm / v.speedKmh) * 3_600_000) / timeScale);
  const departedAt = now - totalMs * (doneKm / route.totalKm);
  return { waypoints, departedAt, arrivesAt: departedAt + totalMs, distanceKm: route.totalKm, penalty: undefined };
}

/** 달팽이 벌칙 적용: now부터 duration 동안 90% 느림 → 도착 시간 연장 */
export function applySnail(l: Letter, now: number): Pick<Letter, 'penalty' | 'arrivesAt'> {
  const until = Math.min(now + SNAIL.durationMs, l.arrivesAt + SNAIL.durationMs);
  const extra = (until - now) * (1 - SNAIL.factor);
  return { penalty: { from: now, until }, arrivesAt: l.arrivesAt + extra };
}

export function contactChance(route: Route, users: { location: LatLng; match: boolean }[], vehicle: VehicleId, planBoost = 0): number {
  const samples: LatLng[] = [];
  for (let i = 0; i <= 24; i++) samples.push(route.at(i / 24));
  const dest = route.at(1);
  let near = 0, nearMatch = 0, destMatch = 0;
  for (const u of users) {
    let d = Infinity;
    for (const s of samples) d = Math.min(d, distanceKm(s, u.location));
    if (d < 400) { near++; if (u.match) nearMatch++; }
    if (u.match && distanceKm(dest, u.location) < 1500) destMatch++;
  }
  const v = VEHICLE_MAP[vehicle];
  const exposure = v.motion === 'orbit' ? 25 : v.motion === 'drift' ? 6 : 0;
  return Math.max(3, Math.min(97, Math.round(12 + nearMatch * 9 + destMatch * 14 + Math.min(10, near * 2) + exposure + planBoost)));
}

/** 봇 편지를 target 상공으로 보내기 위한 목적지 보정 */
export function aimRouteAt(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId, target: LatLng, tolKm = 35): LatLng {
  let d = dest;
  const v = VEHICLE_MAP[vehicle];
  for (let iter = 0; iter < 5; iter++) {
    const r = buildRoute(origin, d, waypoints, vehicle);
    const pMax = v.motion === 'orbit' ? r.segments[0].km / r.totalKm : 1;
    let best = { p: 0, dist: Infinity };
    for (let k = 0; k <= 240; k++) {
      const p = (k / 240) * pMax;
      const dist = distanceKm(r.at(p), target);
      if (dist < best.dist) best = { p, dist };
    }
    if (best.dist <= tolKm) break;
    const frac = v.motion === 'orbit' ? 1 : Math.max(0.25, best.p / pMax);
    d = destinationPoint(d, bearingDeg(r.at(best.p), target), best.dist / frac);
  }
  return d;
}
