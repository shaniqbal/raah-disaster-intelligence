import { z } from 'zod';
import type { LonLat } from '@/lib/geo/geometry';
import { fetchJson, type DataProvider } from './types';

/** Pakistan bounding box used for the query (includes parts of neighbouring countries). */
export const PAKISTAN_BBOX = { minlatitude: 23.5, maxlatitude: 37.2, minlongitude: 60.5, maxlongitude: 77.9 };

export interface Quake {
  id: string;
  magnitude: number;
  place: string;
  time: string;
  depthKm: number;
  coord: LonLat;
  url: string;
}

const FeatureSchema = z.object({
  id: z.string(),
  properties: z.object({ mag: z.number().nullable(), place: z.string().nullable(), time: z.number(), url: z.string().nullable().optional() }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]).or(z.array(z.number()).min(3)) }),
});
const CollectionSchema = z.object({ features: z.array(z.unknown()) });

/** Validate and normalise a USGS GeoJSON response; malformed features are dropped, not guessed. */
export function normaliseUsgs(json: unknown): Quake[] {
  const col = CollectionSchema.parse(json);
  const out: Quake[] = [];
  for (const f of col.features) {
    const r = FeatureSchema.safeParse(f);
    if (!r.success || r.data.properties.mag === null) continue;
    const [lon, lat, depth] = r.data.geometry.coordinates as number[];
    out.push({
      id: r.data.id,
      magnitude: r.data.properties.mag,
      place: r.data.properties.place ?? 'Unknown location',
      time: new Date(r.data.properties.time).toISOString(),
      depthKm: depth,
      coord: [lon, lat],
      url: r.data.properties.url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${r.data.id}`,
    });
  }
  return out.sort((a, b) => b.time.localeCompare(a.time));
}

export function usgsUrl(days = 30, minMag = 4, now = new Date()): string {
  const start = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const q = new URLSearchParams({ format: 'geojson', starttime: start, minmagnitude: String(minMag), orderby: 'time', ...Object.fromEntries(Object.entries(PAKISTAN_BBOX).map(([k, v]) => [k, String(v)])) });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`;
}

export const usgsProvider: DataProvider<Quake[]> = {
  id: 'usgs',
  sourceId: 'usgs-fdsn',
  fetch: async (signal) => normaliseUsgs(await fetchJson(usgsUrl(), 9000, signal)),
};
