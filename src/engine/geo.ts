/**
 * 지구 위 계산: 대권거리, 보간, 방위각, 목적점, 육지 판정, 도시 이름 붙이기.
 */
import { geoContains, geoInterpolate } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { LatLng, Place } from '@/types';
import { CITIES } from '@/data/cities';

// world-atlas land-110m (TopoJSON)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const landTopo = require('world-atlas/land-110m.json');
export const LAND: Feature<Geometry> = feature(landTopo, landTopo.objects.land) as any;

export const EARTH_RADIUS_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** 시작점에서 방위각 방향으로 distanceKm 만큼 이동한 점 */
export function destinationPoint(from: LatLng, bearing: number, distKm: number): LatLng {
  const d = distKm / EARTH_RADIUS_KM;
  const br = toRad(bearing);
  const la1 = toRad(from.lat);
  const lo1 = toRad(from.lng);
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br),
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2),
    );
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}

/** 대권 보간 (t는 0~1 밖으로 외삽 가능 → 궤도 연출용) */
export function interpolate(a: LatLng, b: LatLng): (t: number) => LatLng {
  const f = geoInterpolate([a.lng, a.lat], [b.lng, b.lat]);
  return (t: number) => {
    const [lng, lat] = f(t);
    return { lat, lng };
  };
}

export function isLand(p: LatLng): boolean {
  return geoContains(LAND, [p.lng, p.lat]);
}

export function nearestCity(p: LatLng): { city: string; country: string; distKm: number } {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(p, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { city: best.city, country: best.country, distKm: bestD };
}

/** 좌표에 사람이 읽을 이름을 붙인다. */
export function describePlace(p: LatLng): Place {
  const land = isLand(p);
  const n = nearestCity(p);
  if (!land && n.distKm > 250) {
    return { ...p, city: '바다 위', country: oceanName(p) };
  }
  if (n.distKm > 600) {
    return { ...p, city: `${n.city} 북쪽 어딘가`.replace('북쪽 ', ''), country: n.country };
  }
  return { ...p, city: n.city, country: n.country };
}

function oceanName(p: LatLng): string {
  const { lat, lng } = p;
  if (lat < -60) return '남극해';
  if (lat > 66) return '북극해';
  if (lng > 20 && lng < 147 && lat < 30) return '인도양';
  if ((lng > 147 || lng < -70) && lat > -60) return '태평양';
  if (lng >= -70 && lng <= 20) return '대서양';
  return '태평양';
}

let seed = 1234567;
export function seededRandom(reset?: number) {
  if (reset !== undefined) seed = reset;
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

/** 육지 위 랜덤 지점 (거절 샘플링). rnd 미지정 시 Math.random. */
export function randomLandPoint(rnd: () => number = Math.random): LatLng {
  for (let i = 0; i < 200; i++) {
    const lat = toDeg(Math.asin(rnd() * 1.7 - 0.85)); // 극지방 과대표집 방지
    const lng = rnd() * 360 - 180;
    const p = { lat, lng };
    if (isLand(p) && lat > -58) return p;
  }
  const c = CITIES[Math.floor(rnd() * CITIES.length)];
  return { lat: c.lat, lng: c.lng };
}

/** 정확 위치를 50km 격자로 흐림 처리 (친구에게 보여줄 때) */
export function fuzz50km(p: LatLng): LatLng {
  const stepLat = 50 / 111; // 위도 1도 ≈ 111km
  const stepLng = 50 / (111 * Math.max(0.2, Math.cos(toRad(p.lat))));
  return {
    lat: Math.round(p.lat / stepLat) * stepLat,
    lng: Math.round(p.lng / stepLng) * stepLng,
  };
}

export function formatKm(km: number): string {
  if (km >= 10000) return `${(km / 1000).toFixed(1)}만 km`.replace('만 km', '천 km');
  if (km >= 1000) return `${Math.round(km).toLocaleString('ko-KR')} km`;
  return `${Math.round(km)} km`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분${s % 60 ? ` ${s % 60}초` : ''}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간${m % 60 ? ` ${m % 60}분` : ''}`;
  const d = Math.floor(h / 24);
  return `${d}일${h % 24 ? ` ${h % 24}시간` : ''}`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}
