import geoBase from '@/data/generated/geo-base.json';
import rawGraph from '@/data/generated/road-graph.json';
import { buildGraph, type RawGraph, type RoadGraph } from './graph';
import { linesOf, type LonLat } from './geometry';

export interface Feature<P = Record<string, unknown>> {
  type: 'Feature';
  properties: P;
  geometry: { type: string; coordinates: unknown };
}

export interface GeoBase {
  meta: Record<string, string>;
  country: Feature<{ NAME: string }>[];
  neighbours: Feature<{ NAME: string; ADM0_A3: string }>[];
  provinces: Feature<{ name: string }>[];
  rivers: Feature<{ name: string }>[];
}

export const GEO_BASE = geoBase as unknown as GeoBase;

let graphCache: RoadGraph | null = null;
/** Lazily built routable graph (shared by every engine on the client and server). */
export function getRoadGraph(): RoadGraph {
  if (!graphCache) graphCache = buildGraph(rawGraph as unknown as RawGraph);
  return graphCache;
}
export const ROAD_GRAPH_META = (rawGraph as unknown as RawGraph).meta;

const riverCache = new Map<string, LonLat[][]>();
/** Polylines for a named river (or all rivers when name is omitted). */
export function riverLines(name?: string): LonLat[][] {
  const key = name ?? '*';
  if (!riverCache.has(key)) {
    const feats = GEO_BASE.rivers.filter((f) => !name || f.properties.name === name);
    riverCache.set(key, feats.flatMap((f) => linesOf(f.geometry)));
  }
  return riverCache.get(key)!;
}
