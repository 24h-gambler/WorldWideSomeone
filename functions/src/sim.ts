/** 서버 비행 시뮬 — 클라이언트 src/engine/sim.ts 와 동일 규칙 */
import { EARTH_RADIUS_KM, LatLng, bearingDeg, destinationPoint, distanceKm, interpolate } from './geo';

export const PASSBY_RADIUS_KM = 150;
export const LANDED_WINDOW_MS = 24 * 3_600_000; // 실서비스: 착륙 후 24시간
export const ORBIT_LAPS = 3;
export const SNAIL = { factor: 0.1, durationMs: 30 * 60_000 }; // 실서비스: 30분

export type VehicleId = 'walk' | 'jog' | 'sprint' | 'bike' | 'horse' | 'scooter' | 'car' | 'train' | 'plane' | 'rocket' | 'dragon' | 'ufo' | 'satellite';
export const VEHICLES: Record<VehicleId, { speedKmh: number; motion: 'straight' | 'drift' | 'zigzag' | 'orbit'; catchWindowMultiplier: number; immune?: boolean; unlockFriends: number | null; premiumItem?: 'ufo' | 'orbit' | 'dragon' }> = {
  walk: { speedKmh: 5, motion: 'drift', catchWindowMultiplier: 1.4, unlockFriends: 0 },
  jog: { speedKmh: 10, motion: 'drift', catchWindowMultiplier: 1.3, unlockFriends: 2 },
  sprint: { speedKmh: 18, motion: 'straight', catchWindowMultiplier: 1.2, unlockFriends: 5 },
  bike: { speedKmh: 25, motion: 'straight', catchWindowMultiplier: 1.1, unlockFriends: 8 },
  horse: { speedKmh: 45, motion: 'drift', catchWindowMultiplier: 1, unlockFriends: 12 },
  scooter: { speedKmh: 70, motion: 'straight', catchWindowMultiplier: 1, unlockFriends: 16 },
  car: { speedKmh: 120, motion: 'straight', catchWindowMultiplier: 0.9, unlockFriends: 22 },
  train: { speedKmh: 300, motion: 'straight', catchWindowMultiplier: 0.8, unlockFriends: 30 },
  plane: { speedKmh: 900, motion: 'straight', catchWindowMultiplier: 0.8, unlockFriends: 40 },
  rocket: { speedKmh: 6000, motion: 'straight', catchWindowMultiplier: 0.7, unlockFriends: 55 },
  dragon: { speedKmh: 2500, motion: 'drift', catchWindowMultiplier: 1.2, immune: true, unlockFriends: 80, premiumItem: 'dragon' },
  ufo: { speedKmh: 12000, motion: 'zigzag', catchWindowMultiplier: 2.2, unlockFriends: null, premiumItem: 'ufo' },
  satellite: { speedKmh: 28000, motion: 'orbit', catchWindowMultiplier: 1.5, unlockFriends: null, premiumItem: 'orbit' },
};
export const PLAN_LIMITS = { free: { maxWaypoints: 1, unlockBoost: 0, dailyLetters: 5 }, plus: { maxWaypoints: 2, unlockBoost: 4, dailyLetters: 20 }, pro: { maxWaypoints: 3, unlockBoost: 10, dailyLetters: Infinity } } as const;

export type Route = { totalKm: number; at: (p: number) => LatLng; firstKm: number };

export function buildRoute(origin: LatLng, dest: LatLng, waypoints: LatLng[], vehicle: VehicleId): Route {
  const v = VEHICLES[vehicle];
  const pts = [origin, ...waypoints, dest];
  const segs = pts.slice(0, -1).map((a, i) => ({ a, b: pts[i + 1], km: Math.max(1, distanceKm(a, pts[i + 1])), interp: interpolate(a, pts[i + 1]) }));
  if (v.motion === 'orbit' && segs.length === 1) {
    const seg = segs[0];
    const totalKm = seg.km + ORBIT_LAPS * 2 * Math.PI * EARTH_RADIUS_KM;
    return { totalKm, firstKm: seg.km, at: (p) => seg.interp(Math.min(1, Math.max(0, p)) * (totalKm / seg.km)) };
  }
  const totalKm = segs.reduce((s, x) => s + x.km, 0);
  const base = (p: number): LatLng => {
    let d = Math.min(1, Math.max(0, p)) * totalKm;
    for (const s of segs) { if (d <= s.km) return s.interp(d / s.km); d -= s.km; }
    return segs[segs.length - 1].b;
  };
  if (v.motion === 'zigzag' || v.motion === 'drift') {
    const amp = v.motion === 'zigzag' ? Math.min(420, totalKm * 0.06) : Math.min(160, totalKm * 0.03);
    const freq = v.motion === 'zigzag' ? 6 : 1.5;
    return { totalKm, firstKm: totalKm, at: (p) => {
      const q = Math.min(1, Math.max(0, p));
      const here = base(q);
      if (q <= 0.001 || q >= 0.999) return here;
      const off = Math.sin(q * Math.PI * 2 * freq) * amp * Math.sin(q * Math.PI);
      return destinationPoint(here, bearingDeg(here, base(Math.min(1, q + 0.002))) + 90, off);
    } };
  }
  return { totalKm, firstKm: totalKm, at: base };
}

export type FlightDoc = { origin: LatLng; destination: LatLng; waypoints: LatLng[]; vehicle: VehicleId; departedAt: number; arrivesAt: number; penalty?: { from: number; until: number } | null; status: string };

export function durationMs(totalKm: number, vehicle: VehicleId, timeScale: number) {
  return Math.max(60_000, ((totalKm / VEHICLES[vehicle].speedKmh) * 3_600_000) / timeScale);
}

function effectiveElapsed(l: FlightDoc, now: number) {
  let e = now - l.departedAt;
  if (l.penalty) {
    const a = Math.max(l.penalty.from, l.departedAt), b = Math.min(l.penalty.until, now);
    if (b > a) e -= (b - a) * (1 - SNAIL.factor);
  }
  return e;
}
const penaltyExtra = (l: FlightDoc) => (l.penalty ? (l.penalty.until - l.penalty.from) * (1 - SNAIL.factor) : 0);
export function progressOf(l: FlightDoc, now: number) {
  return Math.min(1, Math.max(0, effectiveElapsed(l, now) / Math.max(1, l.arrivesAt - l.departedAt - penaltyExtra(l))));
}
export function positionOf(l: FlightDoc, now: number) {
  return buildRoute(l.origin, l.destination, l.waypoints ?? [], l.vehicle).at(progressOf(l, now));
}
export function minDistanceBetween(l: FlightDoc, t0: number, t1: number, point: LatLng) {
  const r = buildRoute(l.origin, l.destination, l.waypoints ?? [], l.vehicle);
  const p0 = progressOf(l, t0), p1 = progressOf(l, t1);
  const steps = Math.min(60, Math.max(1, Math.ceil((Math.abs(p1 - p0) * r.totalKm) / 60)));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) best = Math.min(best, distanceKm(r.at(p0 + ((p1 - p0) * i) / steps), point));
  return best;
}
export const catchWindowMs = (v: VehicleId) => Math.round(10 * 60_000 * VEHICLES[v].catchWindowMultiplier); // 실서비스: 10분 기준
export function rerouteThrough(l: FlightDoc, now: number, newWaypoints: LatLng[], timeScale: number) {
  const here = positionOf(l, now);
  const waypoints = [here, ...newWaypoints];
  const route = buildRoute(l.origin, l.destination, waypoints, l.vehicle);
  const totalMs = durationMs(route.totalKm, l.vehicle, timeScale);
  const departedAt = now - totalMs * (distanceKm(l.origin, here) / route.totalKm);
  return { waypoints, departedAt, arrivesAt: departedAt + totalMs, distanceKm: route.totalKm, penalty: null };
}
export function applySnail(l: FlightDoc, now: number) {
  const until = Math.min(now + SNAIL.durationMs, l.arrivesAt + SNAIL.durationMs);
  return { penalty: { from: now, until }, arrivesAt: l.arrivesAt + (until - now) * (1 - SNAIL.factor) };
}
