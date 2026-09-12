/** 서버 비행 시뮬 — 클라이언트 src/engine/sim.ts 와 동일 규칙 */
import { EARTH_RADIUS_KM, LatLng, bearingDeg, destinationPoint, distanceKm, interpolate } from './geo';

export const PASSBY_RADIUS_KM = 150;
export const LANDED_WINDOW_MS = 24 * 3_600_000; // 실서비스: 착륙 후 24시간
export const ORBIT_LAPS = 3;
export const SNAIL = { factor: 0.1, durationMs: 30 * 60_000 }; // 실서비스: 30분

export type VehicleId = 'walk' | 'jog' | 'run' | 'kick' | 'bike' | 'pigeon' | 'seagull' | 'goose' | 'crane' | 'hawk' | 'eagle' | 'albatross' | 'horse' | 'camel' | 'dolphin' | 'cheetah' | 'scooter' | 'kei' | 'bus' | 'sedan' | 'truck' | 'sports' | 'train' | 'ktx' | 'maglev' | 'sail' | 'speedboat' | 'cruise' | 'submarine' | 'hover' | 'balloon' | 'paraglider' | 'heli' | 'prop' | 'airliner' | 'fighter' | 'concorde' | 'rocket' | 'satellite' | 'ufo' | 'carpet' | 'unicorn' | 'dragon';
type Spec = { speedKmh: number; motion: 'straight' | 'drift' | 'zigzag' | 'orbit'; catchWindowMultiplier: number; unlockFriends: number | null; premiumItem?: 'ufo' | 'orbit' | 'dragon' | 'carpet' | 'event'; immune?: boolean; immuneOcean?: boolean; immuneSnail?: boolean; immunePeek?: boolean; builtInShield?: boolean };
const S = (speedKmh: number, motion: Spec['motion'], catchWindowMultiplier: number, unlockFriends: number | null, extra: Partial<Spec> = {}): Spec => ({ speedKmh, motion, catchWindowMultiplier, unlockFriends, ...extra });
export const VEHICLES: Record<VehicleId, Spec> = {
  walk: S(5, 'drift', 1.4, 0), jog: S(9, 'drift', 1.3, 1), run: S(16, 'straight', 1.2, 2), kick: S(15, 'straight', 1.2, 2), bike: S(25, 'straight', 1.1, 3),
  pigeon: S(60, 'drift', 1.1, 4), seagull: S(70, 'drift', 1.1, 5), goose: S(80, 'straight', 1, 7), crane: S(85, 'drift', 1, 9), hawk: S(130, 'straight', 0.8, 12), eagle: S(150, 'straight', 0.9, 15, { immuneSnail: true }), albatross: S(140, 'straight', 1, 18),
  horse: S(45, 'drift', 1, 6), camel: S(40, 'drift', 1.1, 8), dolphin: S(55, 'drift', 1, 10, { immuneOcean: true }), cheetah: S(110, 'straight', 0.9, 14),
  scooter: S(60, 'straight', 1, 11), kei: S(90, 'straight', 1, 13), bus: S(80, 'straight', 1.3, 16), sedan: S(120, 'straight', 0.9, 19), truck: S(95, 'straight', 1, 21, { builtInShield: true }), sports: S(260, 'straight', 0.7, 25), train: S(160, 'straight', 0.9, 23), ktx: S(300, 'straight', 0.8, 30), maglev: S(430, 'straight', 0.8, 36),
  sail: S(20, 'drift', 1.3, 5), speedboat: S(75, 'straight', 1, 12), cruise: S(45, 'drift', 1.4, 17, { builtInShield: true }), submarine: S(40, 'straight', 1.1, 22, { immuneOcean: true, immunePeek: true }), hover: S(90, 'drift', 1, 27),
  balloon: S(30, 'drift', 1.6, 8), paraglider: S(40, 'drift', 1.3, 10), heli: S(250, 'straight', 1, 24), prop: S(350, 'straight', 0.9, 28), airliner: S(900, 'straight', 0.8, 40), fighter: S(2000, 'straight', 0.7, 50, { immuneSnail: true }), concorde: S(2200, 'straight', 0.7, 55),
  rocket: S(6000, 'straight', 0.7, 60), satellite: S(28000, 'orbit', 1.5, null, { premiumItem: 'orbit' }), ufo: S(12000, 'zigzag', 2.2, null, { premiumItem: 'ufo' }),
  carpet: S(800, 'drift', 1.2, null, { premiumItem: 'carpet', immunePeek: true }), unicorn: S(500, 'drift', 1.2, null, { premiumItem: 'event' }), dragon: S(2500, 'drift', 1.2, 80, { premiumItem: 'dragon', immune: true, immuneOcean: true, immuneSnail: true }),
};
export const OCEAN_SINK_MS = 3 * 3_600_000;
export const PLAN_LIMITS = { free: { maxWaypoints: 1, unlockBoost: 0, dailyLetters: 5, dailyPeeks: 0, dailyPulls: 0, monthlyDirect: 0, monthlyCoins: 0, boostDiscount: 0 }, plus: { maxWaypoints: 2, unlockBoost: 4, dailyLetters: 20, dailyPeeks: 3, dailyPulls: 1, monthlyDirect: 0, monthlyCoins: 300, boostDiscount: 0.2 }, pro: { maxWaypoints: 3, unlockBoost: 10, dailyLetters: 1e9, dailyPeeks: 10, dailyPulls: 3, monthlyDirect: 2, monthlyCoins: 1000, boostDiscount: 0.5 } } as const;

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
/** 끌어오기: 현재 위치 → target */
export function pullTo(l: FlightDoc, now: number, target: LatLng, timeScale: number) {
  const here = positionOf(l, now);
  const waypoints = [here];
  const route = buildRoute(l.origin, target, waypoints, l.vehicle);
  const totalMs = durationMs(route.totalKm, l.vehicle, timeScale);
  const departedAt = now - totalMs * (distanceKm(l.origin, here) / route.totalKm);
  return { destination: target, waypoints, departedAt, arrivesAt: departedAt + totalMs, distanceKm: route.totalKm, penalty: null };
}
/** 침수 복귀 */
export function resurface(l: FlightDoc & { sunkAt?: number }, now: number) {
  const paused = Math.max(0, now - (l.sunkAt ?? now));
  return { departedAt: l.departedAt + paused, arrivesAt: l.arrivesAt + paused, status: 'flying', sunkAt: null, sunkUntil: null };
}
export function applySnail(l: FlightDoc, now: number) {
  const until = Math.min(now + SNAIL.durationMs, l.arrivesAt + SNAIL.durationMs);
  return { penalty: { from: now, until }, arrivesAt: l.arrivesAt + (until - now) * (1 - SNAIL.factor) };
}

/** 가속: 현재 위치 유지, 남은 시간을 remainingMs 로 */
export function speedUp(l: FlightDoc, now: number, remainingMs: number) {
  const p = Math.min(0.999, progressOf(l, now));
  const D = Math.max(1000, remainingMs / (1 - p));
  const departedAt = now - p * D;
  return { departedAt, arrivesAt: departedAt + D, penalty: null };
}
/** 다음 windowMs 동안 지날 경로 샘플 (통과 판정 셀 예측용) */
export function upcomingPoints(l: FlightDoc, now: number, windowMs: number, n = 6): LatLng[] {
  const r = buildRoute(l.origin, l.destination, l.waypoints, l.vehicle);
  const p0 = progressOf(l, now), p1 = progressOf(l, now + windowMs);
  return Array.from({ length: n + 1 }).map((_, i) => r.at(p0 + ((p1 - p0) * i) / n));
}
