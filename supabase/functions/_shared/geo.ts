/** 클라이언트 src/engine/geo.ts 와 동일한 규칙 (서버 판정용) */
export type LatLng = { lat: number; lng: number };
export const EARTH_RADIUS_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function bearingDeg(a: LatLng, b: LatLng): number {
  const la1 = toRad(a.lat), la2 = toRad(b.lat), dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
export function destinationPoint(from: LatLng, bearing: number, distKm: number): LatLng {
  const d = distKm / EARTH_RADIUS_KM, br = toRad(bearing), la1 = toRad(from.lat), lo1 = toRad(from.lng);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}
/** 대권 보간 (d3-geo geoInterpolate 와 동일한 수식) */
export function interpolate(a: LatLng, b: LatLng): (t: number) => LatLng {
  const x0 = toRad(a.lng), y0 = toRad(a.lat), x1 = toRad(b.lng), y1 = toRad(b.lat);
  const cy0 = Math.cos(y0), sy0 = Math.sin(y0), cy1 = Math.cos(y1), sy1 = Math.sin(y1);
  const kx0 = cy0 * Math.cos(x0), ky0 = cy0 * Math.sin(x0), kx1 = cy1 * Math.cos(x1), ky1 = cy1 * Math.sin(x1);
  const d = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, Math.sin((y1 - y0) / 2) ** 2 + cy0 * cy1 * Math.sin((x1 - x0) / 2) ** 2))));
  const k = Math.sin(d);
  if (d === 0 || k === 0) return () => ({ lat: a.lat, lng: a.lng });
  return (t) => {
    const B = Math.sin((t *= d)) / k, A = Math.sin(d - t) / k;
    const x = A * kx0 + B * kx1, y = A * ky0 + B * ky1, z = A * sy0 + B * sy1;
    return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
  };
}
export function fuzzToGrid(p: LatLng, km: number): LatLng {
  const stepLat = km / 111, stepLng = km / (111 * Math.max(0.2, Math.cos(toRad(p.lat))));
  return { lat: Math.round(p.lat / stepLat) * stepLat, lng: Math.round(p.lng / stepLng) * stepLng };
}
