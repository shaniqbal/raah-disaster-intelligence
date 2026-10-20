/** Small, dependency-free geometry helpers. Coordinates are [lon, lat] in degrees. */
export type LonLat = [number, number];

const R_KM = 6371.0088;
const RAD = Math.PI / 180;

/** Great-circle distance in kilometres (haversine). */
export function haversineKm(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLon = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Local equirectangular projection to km around a reference latitude; accurate to <1% at the scales used here. */
function toKm(p: LonLat, refLat: number): [number, number] {
  return [p[0] * 111.32 * Math.cos(refLat * RAD), p[1] * 110.574];
}

/** Shortest distance (km) from point p to segment ab. */
export function pointToSegmentKm(p: LonLat, a: LonLat, b: LonLat): number {
  const ref = p[1];
  const [px, py] = toKm(p, ref);
  const [ax, ay] = toKm(a, ref);
  const [bx, by] = toKm(b, ref);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shortest distance (km) from a point to any of the given polylines. */
export function pointToLinesKm(p: LonLat, lines: LonLat[][]): number {
  let best = Infinity;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      // Cheap bounding pre-check: skip segments clearly farther than the current best.
      const a = line[i - 1];
      const b = line[i];
      const minLat = Math.min(a[1], b[1]);
      const maxLat = Math.max(a[1], b[1]);
      const latGapKm = p[1] < minLat ? (minLat - p[1]) * 110.574 : p[1] > maxLat ? (p[1] - maxLat) * 110.574 : 0;
      if (latGapKm > best) continue;
      const d = pointToSegmentKm(p, a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

function orient(a: LonLat, b: LonLat, c: LonLat): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** True when segments ab and cd properly intersect or touch. */
export function segmentsIntersect(a: LonLat, b: LonLat, c: LonLat, d: LonLat): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 <= 0 && o3 * o4 <= 0 && !(o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0);
}

/** True when segment ab crosses any of the polylines. */
export function segmentCrossesLines(a: LonLat, b: LonLat, lines: LonLat[][]): boolean {
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const c = line[i - 1];
      const d = line[i];
      if (Math.max(c[0], d[0]) < minX || Math.min(c[0], d[0]) > maxX) continue;
      if (Math.max(c[1], d[1]) < minY || Math.min(c[1], d[1]) > maxY) continue;
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/** Geometry → list of polylines (works for LineString and MultiLineString). */
export function linesOf(geometry: { type: string; coordinates: unknown }): LonLat[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates as LonLat[]];
  if (geometry.type === 'MultiLineString') return geometry.coordinates as LonLat[][];
  return [];
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
