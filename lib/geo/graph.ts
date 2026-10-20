/**
 * Road-network routing over the Natural Earth major-road graph
 * (built by scripts/build-geodata.mjs). Dijkstra with a binary heap,
 * edge closures, and penalty-based alternative routes.
 */
import { haversineKm, type LonLat } from './geometry';

export interface RawGraph {
  meta: Record<string, unknown>;
  nodes: LonLat[];
  /** [from, to, lengthKm, roadClass] — roadClass 1 = major highway, 2 = other road / connector */
  edges: [number, number, number, number][];
}

export interface RoadGraph {
  nodes: LonLat[];
  edges: { a: number; b: number; km: number; cls: number }[];
  /** adjacency: node -> list of edge indices */
  adj: number[][];
}

/** Assumed free-flow speeds by road class (km/h). Documented in docs/MODEL_METHODOLOGY.md. */
export const SPEED_KMH: Record<number, number> = { 1: 70, 2: 45 };
/** Off-network access legs (settlement → nearest graph node) are estimated at this speed with a detour factor. */
export const ACCESS_SPEED_KMH = 30;
export const ACCESS_DETOUR = 1.3;
/** Trips shorter than this use an estimated local distance instead of the national graph. */
export const LOCAL_TRIP_KM = 15;
export const LOCAL_DETOUR = 1.35;
export const LOCAL_SPEED_KMH = 25;

export function buildGraph(raw: RawGraph): RoadGraph {
  const adj: number[][] = raw.nodes.map(() => []);
  const edges = raw.edges.map(([a, b, km, cls], i) => {
    adj[a].push(i);
    adj[b].push(i);
    return { a, b, km, cls };
  });
  return { nodes: raw.nodes, edges, adj };
}

const nearestCache = new WeakMap<RoadGraph, Map<string, { node: number; km: number }>>();

/** Nearest graph node to a point (memoised linear scan; ~4k nodes, no spatial-index dependency). */
export function nearestNode(g: RoadGraph, p: LonLat): { node: number; km: number } {
  let cache = nearestCache.get(g);
  if (!cache) nearestCache.set(g, (cache = new Map()));
  const key = `${p[0]},${p[1]}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = nearestNodeScan(g, p);
  if (cache.size > 5000) cache.clear();
  cache.set(key, res);
  return res;
}

function nearestNodeScan(g: RoadGraph, p: LonLat): { node: number; km: number } {
  let best = -1;
  let bestKm = Infinity;
  const cosLat = Math.cos((p[1] * Math.PI) / 180);
  for (let i = 0; i < g.nodes.length; i++) {
    const n = g.nodes[i];
    const dx = (n[0] - p[0]) * cosLat;
    const dy = n[1] - p[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestKm) {
      bestKm = d2;
      best = i;
    }
  }
  return { node: best, km: haversineKm(p, g.nodes[best]) };
}

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    this.k.push(key);
    this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= this.k[i]) break;
      [this.k[p], this.k[i]] = [this.k[i], this.k[p]];
      [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.k[0], this.v[0]];
    const lk = this.k.pop()!;
    const lv = this.v.pop()!;
    if (this.k.length) {
      this.k[0] = lk;
      this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.k.length && this.k[l] < this.k[m]) m = l;
        if (r < this.k.length && this.k[r] < this.k[m]) m = r;
        if (m === i) break;
        [this.k[m], this.k[i]] = [this.k[i], this.k[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return top;
  }
}

export interface ShortestPathTree {
  source: number;
  /** travel time in hours to each node (Infinity when unreachable) */
  hours: Float64Array;
  /** edge used to reach each node (-1 for source/unreachable) */
  via: Int32Array;
}

export type EdgeCost = (edgeIndex: number) => number;

export function edgeHours(g: RoadGraph, e: number): number {
  const edge = g.edges[e];
  return edge.km / (SPEED_KMH[edge.cls] ?? 45);
}

/**
 * Single-source Dijkstra. `closed` marks edges that cannot be used;
 * `cost` lets callers penalise edges (used for alternatives).
 */
export function dijkstra(g: RoadGraph, source: number, closed?: Set<number>, cost?: EdgeCost, target?: number): ShortestPathTree {
  const n = g.nodes.length;
  const hours = new Float64Array(n).fill(Infinity);
  const via = new Int32Array(n).fill(-1);
  hours[source] = 0;
  const heap = new MinHeap();
  heap.push(0, source);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > hours[u]) continue;
    if (u === target) break; // early exit: target settled
    for (const e of g.adj[u]) {
      if (closed?.has(e)) continue;
      const edge = g.edges[e];
      const v = edge.a === u ? edge.b : edge.a;
      const nd = d + (cost ? cost(e) : edgeHours(g, e));
      if (nd < hours[v]) {
        hours[v] = nd;
        via[v] = e;
        heap.push(nd, v);
      }
    }
  }
  return { source, hours, via };
}

/** Edge list from source to target using a shortest-path tree. */
export function pathEdges(g: RoadGraph, tree: ShortestPathTree, target: number): number[] | null {
  if (!Number.isFinite(tree.hours[target])) return null;
  const out: number[] = [];
  let cur = target;
  while (cur !== tree.source) {
    const e = tree.via[cur];
    if (e < 0) return null;
    out.push(e);
    const edge = g.edges[e];
    cur = edge.a === cur ? edge.b : edge.a;
  }
  return out.reverse();
}

/** Ordered coordinates for a list of edges starting at `start`. */
export function pathCoords(g: RoadGraph, start: number, edges: number[]): LonLat[] {
  const coords: LonLat[] = [g.nodes[start]];
  let cur = start;
  for (const e of edges) {
    const edge = g.edges[e];
    cur = edge.a === cur ? edge.b : edge.a;
    coords.push(g.nodes[cur]);
  }
  return coords;
}

export interface RouteResult {
  method: 'graph' | 'estimated-local';
  feasible: boolean;
  km: number;
  hours: number;
  coords: LonLat[];
  edges: number[];
  /** explanation of how distance/time were produced */
  note: string;
}

const sumKm = (g: RoadGraph, edges: number[]) => edges.reduce((s, e) => s + g.edges[e].km, 0);
const sumHours = (g: RoadGraph, edges: number[]) => edges.reduce((s, e) => s + edgeHours(g, e), 0);

/**
 * Route between two arbitrary points.
 * - Short trips (< LOCAL_TRIP_KM) are estimated: the national graph has no local streets.
 * - Otherwise: access leg + graph path + access leg.
 */
export function route(
  g: RoadGraph,
  from: LonLat,
  to: LonLat,
  closed?: Set<number>,
  cost?: EdgeCost,
): RouteResult {
  const straight = haversineKm(from, to);
  if (straight < LOCAL_TRIP_KM) {
    const km = straight * LOCAL_DETOUR;
    return {
      method: 'estimated-local',
      feasible: true,
      km,
      hours: km / LOCAL_SPEED_KMH,
      coords: [from, to],
      edges: [],
      note: `Local trip: ${LOCAL_DETOUR}× straight-line distance at ${LOCAL_SPEED_KMH} km/h (no street-level data).`,
    };
  }
  const s = nearestNode(g, from);
  const t = nearestNode(g, to);
  const tree = dijkstra(g, s.node, closed, cost);
  const edges = pathEdges(g, tree, t.node);
  const accessKm = (s.km + t.km) * ACCESS_DETOUR;
  if (!edges) {
    return {
      method: 'graph',
      feasible: false,
      km: Infinity,
      hours: Infinity,
      coords: [],
      edges: [],
      note: 'No open path in the road network under current closures.',
    };
  }
  const km = sumKm(g, edges) + accessKm;
  const hours = sumHours(g, edges) + accessKm / ACCESS_SPEED_KMH;
  return {
    method: 'graph',
    feasible: true,
    km,
    hours,
    coords: [from, ...pathCoords(g, s.node, edges), to],
    edges,
    note: `Dijkstra over Natural Earth major roads (${edges.length} segments) plus ${accessKm.toFixed(1)} km estimated access legs.`,
  };
}

/**
 * Up to `k` alternative routes using the penalty method: after each route is found,
 * its edges are made `penalty`× more expensive and the search is repeated.
 * Alternatives sharing more than `maxOverlap` of their length with an earlier route are discarded.
 */
export function alternativeRoutes(
  g: RoadGraph,
  from: LonLat,
  to: LonLat,
  closed?: Set<number>,
  k = 3,
  penalty = 3,
  maxOverlap = 0.7,
): RouteResult[] {
  const first = route(g, from, to, closed);
  if (!first.feasible || first.method !== 'graph') return [first];
  const results: RouteResult[] = [first];
  const penalised = new Map<number, number>();
  for (const e of first.edges) penalised.set(e, penalty);
  for (let i = 0; i < k * 2 && results.length < k; i++) {
    const cost: EdgeCost = (e) => edgeHours(g, e) * (penalised.get(e) ?? 1);
    const cand = route(g, from, to, closed, cost);
    if (!cand.feasible) break;
    // Report true (unpenalised) hours for the candidate.
    cand.hours = sumHours(g, cand.edges) + (cand.hours - cand.edges.reduce((s, e) => s + cost(e), 0));
    const candKm = sumKm(g, cand.edges) || 1;
    const isDistinct = results.every((r) => {
      const set = new Set(r.edges);
      const shared = cand.edges.filter((e) => set.has(e)).reduce((s, e) => s + g.edges[e].km, 0);
      return shared / candKm <= maxOverlap;
    });
    for (const e of cand.edges) penalised.set(e, (penalised.get(e) ?? 1) * penalty);
    if (isDistinct) results.push(cand);
  }
  return results;
}

/** Nodes reachable from any of the sources (BFS over open edges). */
export function reachableFrom(g: RoadGraph, sources: number[], closed?: Set<number>): Uint8Array {
  const seen = new Uint8Array(g.nodes.length);
  const stack = [...sources];
  for (const s of sources) seen[s] = 1;
  while (stack.length) {
    const u = stack.pop()!;
    for (const e of g.adj[u]) {
      if (closed?.has(e)) continue;
      const edge = g.edges[e];
      const v = edge.a === u ? edge.b : edge.a;
      if (!seen[v]) {
        seen[v] = 1;
        stack.push(v);
      }
    }
  }
  return seen;
}
