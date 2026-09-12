/**
 * 비행 시뮬레이션: 경로 기하, 위치 계산, 통과 판정, 잡기 창.
 * 서버 도입 시 이 파일의 "위치 계산"은 그대로 쓰고, 봇 행동(store/sim-bots)만 서버 이벤트로 교체한다.
 */
import type { LatLng, Letter, VehicleId } from '@/types';
import { VEHICLE_MAP } from '@/data/vehicles';
import { bearingDeg, destinationPoint, distanceKm, interpolate, EARTH_RADIUS_KM } from './geo';

export const PASSBY_RADIUS_KM = 150;
export const LANDED_RADIUS_KM = 150;
export const LANDED_WINDOW_MS = 10 * 60_000; // 착륙 후 집어갈 수 있는 시간(실제)
export const ORBIT_LAPS = 3;

type Segment = { a: LatLng; b: LatLng; km: number; interp: (t: number) => LatLng };

export type Route = {
  segments: Segment[];
  totalKm: number;
  /** p: 0..1 → 위치 */
  at: (p: number) => LatLng;
};

const routeCache = new Map<string, Route>();

function routeKey(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId) {
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}|${waypoints
    .map((w) => `${w.lat.toFixed(3)},${w.lng.toFixed(3)}`)
    .join(';')}|${vehicle}`;
}

export function buildRoute(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId): Route {
  const key = routeKey(origin, dest, waypoints, vehicle);
  const cached = routeCache.get(key);
  if (cached) return cached;

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
    // 궤도: 대권을 따라 ORBIT_LAPS 바퀴 더 돌고 도착
    const seg = segments[0];
    const lapKm = 2 * Math.PI * EARTH_RADIUS_KM;
    const totalKm = seg.km + ORBIT_LAPS * lapKm;
    const ratio = totalKm / seg.km; // interp의 t 배수
    route = {
      segments,
      totalKm,
      at: (p) => seg.interp(Math.min(1, Math.max(0, p)) * ratio),
    };
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
      const amp = v.motion === 'zigzag' ? Math.min(420, totalKm * 0.06) : Math.min(220, totalKm * 0.035);
      const freq = v.motion === 'zigzag' ? 6 : 1.5;
      route = {
        segments,
        totalKm,
        at: (p) => {
          const q = Math.min(1, Math.max(0, p));
          const here = base(q);
          if (q <= 0.001 || q >= 0.999) return here;
          const ahead = base(Math.min(1, q + 0.002));
          const brg = bearingDeg(here, ahead) + 90;
          const off = Math.sin(q * Math.PI * 2 * freq) * amp * Math.sin(q * Math.PI); // 양끝은 0
          return destinationPoint(here, brg, off);
        },
      };
    } else {
      route = { segments, totalKm, at: base };
    }
  }
  if (routeCache.size > 300) routeCache.clear();
  routeCache.set(key, route);
  return route;
}

export function routeOf(letter: Letter): Route {
  return buildRoute(letter.origin, letter.destination, letter.waypoints, letter.vehicle);
}

/** 발송 계획: 총거리와 실제 소요 시간(ms) */
export function planFlight(
  origin: LatLng,
  dest: LatLng,
  waypoints: LatLng[],
  vehicle: VehicleId,
  timeScale: number,
) {
  const route = buildRoute(origin, dest, waypoints, vehicle);
  const v = VEHICLE_MAP[vehicle];
  const simHours = route.totalKm / v.speedKmh;
  const durationMs = Math.max(20_000, (simHours * 3_600_000) / timeScale);
  return { distanceKm: route.totalKm, durationMs, simHours };
}

export function progressOf(letter: Letter, now: number): number {
  if (letter.status !== 'flying') return letter.status === 'landed' || letter.status === 'caught' || letter.status === 'expired' ? 1 : progressAtStop(letter);
  const p = (now - letter.departedAt) / Math.max(1, letter.arrivesAt - letter.departedAt);
  return Math.min(1, Math.max(0, p));
}

/** 장난(반환/바다/우주)으로 멈춘 편지의 마지막 진행률 */
function progressAtStop(letter: Letter): number {
  const ev = letter.events.find((e) => e.type === 'returned' || e.type === 'ocean' || e.type === 'space');
  if (!ev) return 1;
  const p = (ev.at - letter.departedAt) / Math.max(1, letter.arrivesAt - letter.departedAt);
  return Math.min(1, Math.max(0, p));
}

export function positionOf(letter: Letter, now: number): LatLng {
  const p = progressOf(letter, now);
  return routeOf(letter).at(p);
}

export function headingOf(letter: Letter, now: number): number {
  const p = progressOf(letter, now);
  const r = routeOf(letter);
  const a = r.at(Math.max(0, p - 0.002));
  const b = r.at(Math.min(1, p + 0.002));
  return bearingDeg(a, b);
}

/** 아크 그리기용 샘플 (궤도는 마지막 1바퀴만 그려 시각적 과밀 방지) */
export function pathSamples(letter: Letter, n = 72): LatLng[] {
  const r = routeOf(letter);
  const v = VEHICLE_MAP[letter.vehicle];
  const out: LatLng[] = [];
  if (v.motion === 'orbit') {
    const lapKm = 2 * Math.PI * EARTH_RADIUS_KM;
    const start = Math.max(0, 1 - lapKm / r.totalKm);
    for (let i = 0; i <= n; i++) out.push(r.at(start + (i / n) * (1 - start)));
    return out;
  }
  for (let i = 0; i <= n; i++) out.push(r.at(i / n));
  return out;
}

export function remainingMs(letter: Letter, now: number): number {
  return Math.max(0, letter.arrivesAt - now);
}

/** 이전 틱 ~ 현재 사이에서 point와의 최소 거리(빠른 물체가 반경을 건너뛰는 것 방지) */
export function minDistanceBetween(letter: Letter, t0: number, t1: number, point: LatLng): number {
  const r = routeOf(letter);
  const p0 = progressOf(letter, t0);
  const p1 = progressOf(letter, t1);
  const kmMoved = Math.abs(p1 - p0) * r.totalKm;
  const steps = Math.min(40, Math.max(1, Math.ceil(kmMoved / 60)));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const p = p0 + ((p1 - p0) * i) / steps;
    best = Math.min(best, distanceKm(r.at(p), point));
  }
  return best;
}

/** 잡기 창(실제 ms): 운송수단별 */
export function catchWindowMs(vehicle: VehicleId): number {
  return Math.round(75_000 * VEHICLE_MAP[vehicle].catchWindowMultiplier);
}

/** 컨택 가능성 %: 조건에 맞는 유저가 경로/목적지 근처에 얼마나 있는지 */
export function contactChance(
  route: Route,
  users: { location: LatLng; match: boolean }[],
  vehicle: VehicleId,
): number {
  const samples: LatLng[] = [];
  for (let i = 0; i <= 24; i++) samples.push(route.at(i / 24));
  const dest = route.at(1);
  let near = 0;
  let nearMatch = 0;
  let destMatch = 0;
  for (const u of users) {
    let d = Infinity;
    for (const s of samples) d = Math.min(d, distanceKm(s, u.location));
    if (d < 400) {
      near++;
      if (u.match) nearMatch++;
    }
    if (u.match && distanceKm(dest, u.location) < 1500) destMatch++;
  }
  const v = VEHICLE_MAP[vehicle];
  const exposure = v.motion === 'orbit' ? 25 : v.motion === 'drift' ? 8 : 0;
  const pct = 12 + nearMatch * 9 + destMatch * 14 + Math.min(10, near * 2) + exposure;
  return Math.max(3, Math.min(97, Math.round(pct)));
}

/**
 * 목적지를 보정해 실제 경로(표류·지그재그·궤도 포함)가 target 상공(≤ tolKm)을 지나게 한다.
 * 봇 편지를 사용자 머리 위로 보낼 때 사용.
 */
export function aimRouteAt(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId, target: LatLng, tolKm = 35): LatLng {
  let d = dest;
  const v = VEHICLE_MAP[vehicle];
  for (let iter = 0; iter < 5; iter++) {
    const r = buildRoute(origin, d, waypoints, vehicle);
    const pMax = v.motion === 'orbit' ? r.segments[0].km / r.totalKm : 1; // 궤도는 첫 통과만
    let best = { p: 0, dist: Infinity };
    const N = 240;
    for (let k = 0; k <= N; k++) {
      const p = (k / N) * pMax;
      const dist = distanceKm(r.at(p), target);
      if (dist < best.dist) best = { p, dist };
    }
    if (best.dist <= tolKm) break;
    const here = r.at(best.p);
    const brg = bearingDeg(here, target);
    const frac = v.motion === 'orbit' ? 1 : Math.max(0.25, best.p / pMax);
    d = destinationPoint(d, brg, best.dist / frac);
  }
  return d;
}
