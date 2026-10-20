/**
 * RAAH what-if engine. Fully deterministic: the same definition + parameters
 * always produce the same outputs. See docs/MODEL_METHODOLOGY.md.
 *
 * Pipeline for a scenario hour:
 *   hazard magnitude → hazard footprint → settlement exposure + road closures
 * and, at the forecast peak, the response plan:
 *   routing (Dijkstra) → shelter assignment → unit allocation → coverage,
 *   bottlenecks and readiness.
 */
import { getRoadGraph, riverLines } from '@/lib/geo/data';
import { clamp, haversineKm, pointToLinesKm, pointToSegmentKm, round, segmentCrossesLines, type LonLat } from '@/lib/geo/geometry';
import {
  ACCESS_DETOUR,
  ACCESS_SPEED_KMH,
  LOCAL_DETOUR,
  LOCAL_SPEED_KMH,
  LOCAL_TRIP_KM,
  dijkstra,
  edgeHours,
  nearestNode,
  pathCoords,
  pathEdges,
  reachableFrom,
  type RoadGraph,
  type ShortestPathTree,
} from '@/lib/geo/graph';
import type { ResourceType, ScenarioDefinition, ScenarioParams, Settlement, Shelter } from './types';

export const ENGINE_VERSION = 'raah-sim-1.0';

// ---- Operational assumptions (documented in methodology) ----
export const BOAT_PERSONS_PER_H = 10 / 1.5; // 10 people per 1.5 h cycle
export const TEAM_PERSONS_PER_H = 15;
export const AMBULANCE_SERVICE_H = 0.75;
export const BOAT_SPEED_KMH = 20;
export const FOOT_PENALTY_H = 8;
export const CROSSING_DETOUR = 2.2;
const ROAD_DEPTH_LIMIT_M = 1.0;
const URBAN_ROAD_DEPTH_LIMIT_M = 0.3;
const BRIDGE_APPROACH_KM = 12;
/** Evacuees are not routed to shelters further than this by road/boat (counted as unsheltered instead). */
export const MAX_SHELTER_TRIP_H = 4;
/** Inundation depth proxy (m) at a settlement centre above which evacuation needs boats. */
const BOAT_DEPTH_M = 1.0;
/** Foot teams reaching an isolated settlement assist fewer people per hour. */
export const FOOT_TEAM_PERSONS_PER_H = 5;
/** Share of an isolated settlement's population needing medical evacuation. */
const ISOLATED_MEDICAL_SHARE = 0.002;
const FIRST_ARRIVAL_TARGET_H = 6;

// ---------------------------------------------------------------------------
// Hazard
// ---------------------------------------------------------------------------

/** Smooth rise from 0 at t=0 to 1 at peak, then hold. */
export function intensityAt(def: ScenarioDefinition, hour: number): number {
  if (hour <= 0) return 0;
  if (hour >= def.peakH) return 1;
  const x = hour / def.peakH;
  return x * x * (3 - 2 * x);
}

export type HazardFootprint =
  | { kind: 'corridor'; lines: LonLat[][]; halfWidthKm: number; magnitude: number; magnitudeLabel: string; depthAt: (dKm: number) => number; roadDepthLimitM: number }
  | { kind: 'slides'; slides: { id: string; label: string; coord: LonLat; active: boolean }[]; radiusKm: number; magnitude: number; magnitudeLabel: string };

interface Prepared {
  def: ScenarioDefinition;
  lines: LonLat[][];
  /** edges inside the scenario bbox with precomputed geometry */
  edges: { e: number; midDist: number; bridge: boolean; a: LonLat; b: LonLat; mid: LonLat }[];
}

const preparedCache = new Map<string, Prepared>();

function inBox(p: LonLat, box: [number, number, number, number], pad = 0) {
  return p[0] >= box[0] - pad && p[0] <= box[2] + pad && p[1] >= box[1] - pad && p[1] <= box[3] + pad;
}

function prepare(def: ScenarioDefinition): Prepared {
  const cached = preparedCache.get(def.id);
  if (cached) return cached;
  const g = getRoadGraph();
  let lines: LonLat[][] = [];
  if (def.hazard.kind === 'riverine') {
    lines = def.hazard.rivers
      .flatMap((r) => riverLines(r))
      .map((l) => l.filter((p) => inBox(p, def.bbox, 0.4)))
      .filter((l) => l.length > 1);
  } else if (def.hazard.kind === 'pluvial') {
    lines = [def.hazard.channel];
  }
  const edges: Prepared['edges'] = [];
  const crossing: LonLat[] = [];
  g.edges.forEach((edge, e) => {
    const a = g.nodes[edge.a];
    const b = g.nodes[edge.b];
    if (!inBox(a, def.bbox, 0.2) && !inBox(b, def.bbox, 0.2)) return;
    const mid: LonLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const midDist = lines.length ? pointToLinesKm(mid, lines) : Infinity;
    const crosses = def.hazard.kind === 'riverine' && lines.length > 0 && segmentCrossesLines(a, b, lines);
    if (crosses) crossing.push(mid);
    edges.push({ e, midDist, bridge: crosses, a, b, mid });
  });
  // Embanked approaches: edges near a river crossing behave like the bridge itself.
  if (crossing.length) {
    for (const ed of edges) {
      if (!ed.bridge && crossing.some((c) => haversineKm(c, ed.mid) <= BRIDGE_APPROACH_KM)) ed.bridge = true;
    }
  }
  const prepared = { def, lines, edges };
  preparedCache.set(def.id, prepared);
  return prepared;
}

export function hazardAt(def: ScenarioDefinition, params: ScenarioParams, hour: number): HazardFootprint {
  const I = intensityAt(def, hour);
  const hz = def.hazard;
  const prep = prepare(def);
  if (hz.kind === 'riverine') {
    const rise = params.riverRiseM * I;
    const w = rise > 0 ? hz.baseKm + hz.kmPerMetre * rise : 0;
    return {
      kind: 'corridor',
      lines: prep.lines,
      halfWidthKm: w,
      magnitude: rise,
      magnitudeLabel: `${round(rise, 2)} m above bankfull`,
      depthAt: (d) => (w > 0 && d < w ? rise * (1 - d / w) : 0),
      roadDepthLimitM: ROAD_DEPTH_LIMIT_M,
    };
  }
  if (hz.kind === 'pluvial') {
    const rain = params.rainfallMm * I;
    const excess = Math.max(0, rain - hz.drainageCapacityMm);
    const w = excess > 0 ? hz.baseKm + hz.kmPerMm * excess : 0;
    return {
      kind: 'corridor',
      lines: prep.lines,
      halfWidthKm: w,
      magnitude: rain,
      magnitudeLabel: `${round(rain, 0)} mm fallen · ${round(excess, 0)} mm over drainage capacity`,
      depthAt: (d) => (w > 0 && d < w ? (excess / 150) * (1 - d / w) : 0),
      roadDepthLimitM: URBAN_ROAD_DEPTH_LIMIT_M,
    };
  }
  const sev = params.slideSeverity;
  const slides = hz.slides.map((s) => ({ id: s.id, label: s.label, coord: s.coord, active: sev >= s.minSeverity && hour >= s.activatesAtH }));
  return {
    kind: 'slides',
    slides,
    radiusKm: hz.baseRadiusKm + hz.kmPerSeverity * sev,
    magnitude: sev,
    magnitudeLabel: `severity ${round(sev, 2)} · ${slides.filter((s) => s.active).length} active slide(s)`,
  };
}

/** Town modelled as a disk of radius r (km) derived from its assumed population. */
export const settlementRadiusKm = (population: number) => 0.5 + Math.sqrt(population / 50000);

/** Fraction of a disk-shaped settlement inside the hazard footprint (linear approximation). */
export function exposureFraction(fp: HazardFootprint, coord: LonLat, radiusKm: number): number {
  if (fp.kind === 'corridor') {
    if (fp.halfWidthKm <= 0) return 0;
    const d = pointToLinesKm(coord, fp.lines);
    return clamp((fp.halfWidthKm - (d - radiusKm)) / (2 * radiusKm), 0, 1);
  }
  let worst = 0;
  for (const s of fp.slides) {
    if (!s.active) continue;
    const d = haversineKm(coord, s.coord);
    worst = Math.max(worst, 0.5 * clamp((fp.radiusKm - (d - radiusKm)) / (2 * radiusKm), 0, 1));
  }
  return worst;
}

function closedEdgesFor(def: ScenarioDefinition, params: ScenarioParams, fp: HazardFootprint, opts: { ignoreSlides?: boolean } = {}): Set<number> {
  const prep = prepare(def);
  const closed = new Set<number>();
  const toggles = def.closures.filter((c) => params.closures.includes(c.id));
  for (const ed of prep.edges) {
    if (toggles.some((t) => haversineKm(t.coord, ed.mid) <= t.radiusKm)) {
      closed.add(ed.e);
      continue;
    }
    if (fp.kind === 'corridor') {
      if (fp.halfWidthKm <= 0) continue;
      if (ed.bridge) {
        if (def.hazard.kind === 'riverine' && fp.magnitude >= params.bridgeCloseM) closed.add(ed.e);
        continue;
      }
      if (ed.midDist < fp.halfWidthKm && fp.depthAt(ed.midDist) > fp.roadDepthLimitM) closed.add(ed.e);
    } else if (!opts.ignoreSlides) {
      for (const s of fp.slides) {
        if (!s.active) continue;
        if (haversineKm(s.coord, ed.mid) <= fp.radiusKm || haversineKm(s.coord, ed.a) <= fp.radiusKm || haversineKm(s.coord, ed.b) <= fp.radiusKm) {
          closed.add(ed.e);
          break;
        }
      }
    }
  }
  return closed;
}

// ---------------------------------------------------------------------------
// Light state (any hour) — exposure and closures, no routing.
// ---------------------------------------------------------------------------

export interface HourState {
  hour: number;
  intensity: number;
  footprint: HazardFootprint;
  closedEdges: number[];
  closedRoadKm: number;
  exposure: { id: string; fraction: number; people: number }[];
  exposedPeople: number;
  floodedShelters: string[];
}

export function stateAt(def: ScenarioDefinition, params: ScenarioParams, hour: number): HourState {
  const g = getRoadGraph();
  const fp = hazardAt(def, params, hour);
  const closed = closedEdgesFor(def, params, fp);
  const k = params.demandPct / 100;
  const exposure = def.settlements.map((s) => {
    const fraction = exposureFraction(fp, s.coord, settlementRadiusKm(s.population));
    return { id: s.id, fraction: round(fraction, 3), people: Math.round(s.population * k * fraction) };
  });
  const floodedShelters = def.shelters.filter((sh) => fp.kind === 'corridor' && exposureFraction(fp, sh.coord, 0.3) > 0.05).map((s) => s.id);
  return {
    hour,
    intensity: intensityAt(def, hour),
    footprint: fp,
    closedEdges: [...closed],
    closedRoadKm: round([...closed].reduce((s, e) => s + g.edges[e].km, 0), 0),
    exposure,
    exposedPeople: exposure.reduce((s, e) => s + e.people, 0),
    floodedShelters,
  };
}

// ---------------------------------------------------------------------------
// Routing context at a fixed closure set
// ---------------------------------------------------------------------------

export interface Trip {
  feasible: boolean;
  hours: number;
  km: number;
  method: 'graph' | 'estimated-local' | 'boat' | 'foot-crossing';
  coords: LonLat[];
  note: string;
  /** graph edges used (graph routes only) */
  edges?: number[];
}

class Router {
  private trees = new Map<number, ShortestPathTree>();
  private reach = new Map<string, Uint8Array>();
  constructor(
    private g: RoadGraph,
    private closed: Set<number>,
    private fp: HazardFootprint,
    private toggles: { coord: LonLat; radiusKm: number }[],
  ) {}

  private tree(node: number) {
    let t = this.trees.get(node);
    if (!t) {
      t = dijkstra(this.g, node, this.closed);
      this.trees.set(node, t);
    }
    return t;
  }

  /** Local trips: the corridor or a closed crossing forces a detour. */
  private localPenalty(from: LonLat, to: LonLat): string | null {
    if (this.fp.kind === 'corridor' && this.fp.halfWidthKm >= 0.3 && segmentCrossesLines(from, to, this.fp.lines)) return 'crosses the flooded corridor';
    for (const t of this.toggles) if (pointToSegmentKm(t.coord, from, to) <= t.radiusKm) return 'passes a closed crossing';
    if (this.fp.kind === 'slides') {
      for (const s of this.fp.slides) if (s.active && pointToSegmentKm(s.coord, from, to) <= this.fp.radiusKm) return 'blocked by landslide';
    }
    return null;
  }

  road(from: LonLat, to: LonLat): Trip {
    const straight = haversineKm(from, to);
    if (straight < LOCAL_TRIP_KM) {
      const km = straight * LOCAL_DETOUR;
      const penalty = this.localPenalty(from, to);
      if (penalty === 'blocked by landslide') {
        return { feasible: false, hours: Infinity, km: Infinity, method: 'estimated-local', coords: [], note: 'Local road blocked by landslide.' };
      }
      const factor = penalty ? CROSSING_DETOUR : 1;
      return {
        feasible: true,
        hours: (km * factor) / LOCAL_SPEED_KMH,
        km: km * factor,
        method: 'estimated-local',
        coords: [from, to],
        note: `Estimated local trip (${LOCAL_DETOUR}× straight line at ${LOCAL_SPEED_KMH} km/h)${penalty ? `; ${penalty} → ${CROSSING_DETOUR}× detour` : ''}.`,
      };
    }
    const s = nearestNode(this.g, from);
    const t = nearestNode(this.g, to);
    const tree = this.tree(s.node);
    const edges = pathEdges(this.g, tree, t.node);
    if (!edges) return { feasible: false, hours: Infinity, km: Infinity, method: 'graph', coords: [], note: 'No open road path under current closures.' };
    const accessKm = (s.km + t.km) * ACCESS_DETOUR;
    const km = edges.reduce((sum, e) => sum + this.g.edges[e].km, 0) + accessKm;
    const hours = edges.reduce((sum, e) => sum + edgeHours(this.g, e), 0) + accessKm / ACCESS_SPEED_KMH;
    return {
      feasible: true,
      hours,
      km,
      method: 'graph',
      coords: [from, ...pathCoords(this.g, s.node, edges), to],
      note: `Dijkstra over ${edges.length} road segments + ${round(accessKm, 1)} km access legs.`,
      edges,
    };
  }

  /** Is the point connected by road to any of the depot points? */
  connected(point: LonLat, depots: LonLat[]): boolean {
    return depots.some((d) => this.road(d, point).feasible);
  }

  reachableSet(depots: LonLat[]): Uint8Array {
    const key = depots.map((d) => d.join(',')).join('|');
    let r = this.reach.get(key);
    if (!r) {
      r = reachableFrom(this.g, depots.map((d) => nearestNode(this.g, d).node), this.closed);
      this.reach.set(key, r);
    }
    return r;
  }
}

const boatTrip = (from: LonLat, to: LonLat): Trip => {
  const km = haversineKm(from, to) * 1.2;
  return { feasible: true, hours: km / BOAT_SPEED_KMH, km, method: 'boat', coords: [from, to], note: `Boat/trailer transfer: 1.2× straight line at ${BOAT_SPEED_KMH} km/h.` };
};

/**
 * Route redundancy test (penalty method, single search): penalise the primary
 * route's edges ×3 and check whether a path that shares ≤70% of its length
 * exists within 2× the primary travel time.
 */
function hasAlternative(g: RoadGraph, from: LonLat, to: LonLat, primary: number[], closed: Set<number>): boolean {
  if (!primary.length) return false;
  const s = nearestNode(g, from).node;
  const t = nearestNode(g, to).node;
  const used = new Set(primary);
  const tree = dijkstra(g, s, closed, (e) => edgeHours(g, e) * (used.has(e) ? 3 : 1), t);
  const alt = pathEdges(g, tree, t);
  if (!alt) return false;
  const altKm = alt.reduce((a, e) => a + g.edges[e].km, 0) || 1;
  const sharedKm = alt.filter((e) => used.has(e)).reduce((a, e) => a + g.edges[e].km, 0);
  const primaryH = primary.reduce((a, e) => a + edgeHours(g, e), 0);
  const altH = alt.reduce((a, e) => a + edgeHours(g, e), 0);
  return sharedKm / altKm <= 0.7 && altH <= 2 * primaryH;
}

// ---------------------------------------------------------------------------
// Plan at peak
// ---------------------------------------------------------------------------

export interface Unit {
  id: string;
  type: ResourceType;
  depotId: string;
  depotName: string;
  coord: LonLat;
}

export type NeedKind = 'boat' | 'team' | 'ambulance';

export interface Need {
  id: string;
  settlementId: string;
  kind: NeedKind;
  label: string;
  demand: number;
  weight: number;
  /** demand fraction over time follows the settlement's exposure curve */
  isolated: boolean;
}

export interface Assignment {
  unitId: string;
  needId: string;
  travelH: number;
  /** people (or medical cases) this unit can serve within the window */
  contribution: number;
  reason: string;
  alternatives: { unitId: string; travelH: number; contribution: number }[];
  source: 'planner' | 'baseline' | 'manual';
}

export interface ShelterAssignment {
  settlementId: string;
  shelterId: string;
  people: number;
  trip: Trip;
}

export interface Bottleneck {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
}

export interface ReadinessComponent {
  id: string;
  label: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface TimelineEvent {
  hour: number;
  kind: 'hazard' | 'closure' | 'dispatch' | 'arrival' | 'shelter' | 'note';
  text: string;
}

export interface SettlementPlan {
  settlement: Settlement;
  exposureFraction: number;
  exposedPeople: number;
  roadAccess: boolean;
  isolated: boolean;
  deepWater: boolean;
  assistedDemand: number;
  medicalDemand: number;
  shelterDemand: number;
  served: number;
  medicalServed: number;
  firstArrivalH: number | null;
  primaryShelter: ShelterAssignment | null;
}

export interface Metrics {
  exposedPeople: number;
  assistedDemand: number;
  served: number;
  coveragePct: number;
  unmet: number;
  medicalDemand: number;
  medicalServed: number;
  shelterDemand: number;
  shelterCapacity: number;
  sheltered: number;
  unsheltered: number;
  shelterUtilPct: number;
  closedRoadKm: number;
  roadCutSettlements: number;
  isolatedSettlements: number;
  isolatedPeople: number;
  medianFirstArrivalH: number | null;
  unitsDeployed: number;
  unitsTotal: number;
  routesFeasiblePct: number;
}

export interface ScenarioPlan {
  engineVersion: string;
  scenarioId: string;
  params: ScenarioParams;
  peak: HourState;
  current: HourState;
  units: Unit[];
  needs: Need[];
  assignments: Assignment[];
  settlements: SettlementPlan[];
  shelters: { shelter: Shelter; capacity: number; assigned: number; usable: boolean; reason?: string }[];
  shelterAssignments: ShelterAssignment[];
  dispatchTrips: { unitId: string; settlementId: string; trip: Trip }[];
  metrics: Metrics;
  bottlenecks: Bottleneck[];
  readiness: { score: number; components: ReadinessComponent[] };
  series: { hour: number; exposed: number; demand: number; served: number }[];
  timeline: TimelineEvent[];
}

/** Largest-remainder distribution of a total across depots by their base share. */
export function distribute(total: number, weights: number[]): number[] {
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (wsum === 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / wsum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

export function buildUnits(def: ScenarioDefinition, params: ScenarioParams): Unit[] {
  const units: Unit[] = [];
  const totals: Record<ResourceType, number> = { boat: params.boats, team: params.teams, ambulance: params.ambulances };
  const prefix: Record<ResourceType, string> = { boat: 'BOAT', team: 'TEAM', ambulance: 'AMB' };
  (Object.keys(totals) as ResourceType[]).forEach((type) => {
    const counts = distribute(totals[type], def.depots.map((d) => d.base[type]));
    def.depots.forEach((d, i) => {
      for (let n = 1; n <= counts[i]; n++) {
        units.push({ id: `${prefix[type]}-${d.id.replace('dp-', '').toUpperCase()}-${String(n).padStart(2, '0')}`, type, depotId: d.id, depotName: d.name, coord: d.coord });
      }
    });
  });
  return units;
}

const needWeight: Record<NeedKind, number> = { ambulance: 2, boat: 1.5, team: 1 };

function unitRate(unit: Unit, travelH: number, onFoot = false): number {
  if (unit.type === 'boat') return BOAT_PERSONS_PER_H;
  if (unit.type === 'team') return onFoot ? FOOT_TEAM_PERSONS_PER_H : TEAM_PERSONS_PER_H;
  return 1 / (2 * travelH + AMBULANCE_SERVICE_H);
}

/**
 * @param manual dispatcher overrides: unitId → needId (reassign) or null (stand down).
 */
export function computePlan(def: ScenarioDefinition, params: ScenarioParams, manual?: Record<string, string | null>): ScenarioPlan {
  const g = getRoadGraph();
  const peak = stateAt(def, params, def.durationH);
  const current = stateAt(def, params, clamp(params.hour, 0, def.durationH));
  const fp = peak.footprint;
  const closed = new Set(peak.closedEdges);
  const toggles = def.closures.filter((c) => params.closures.includes(c.id));
  const router = new Router(g, closed, fp, toggles);
  // Landslide: teams can cross blocks on foot — routing that ignores slide closures.
  const footRouter = fp.kind === 'slides' ? new Router(g, closedEdgesFor(def, params, fp, { ignoreSlides: true }), { ...fp, slides: fp.slides.map((s) => ({ ...s, active: false })) }, toggles) : null;
  const k = params.demandPct / 100;
  const window = def.durationH;

  // ---- Settlement demand ----
  const depotCoords = def.depots.map((d) => d.coord);
  const settlementInfo = def.settlements.map((s) => {
    const ex = peak.exposure.find((e) => e.id === s.id)!;
    const roadAccess = router.connected(s.coord, depotCoords);
    const deepWater = fp.kind === 'corridor' && fp.depthAt(pointToLinesKm(s.coord, fp.lines)) > BOAT_DEPTH_M;
    const isolated = !roadAccess;
    return { s, ex, roadAccess, deepWater, isolated };
  });

  const needs: Need[] = [];
  for (const { s, ex, roadAccess, deepWater, isolated } of settlementInfo) {
    const assisted = Math.round(ex.people * def.assistShare);
    const isolationDemand = isolated && fp.kind === 'slides' ? Math.round(s.population * k * def.isolationNeedShare) : 0;
    const evacDemand = assisted + isolationDemand;
    if (evacDemand > 0) {
      const kind: NeedKind = fp.kind === 'corridor' && (!roadAccess || deepWater) ? 'boat' : 'team';
      needs.push({ id: `${s.id}:evac`, settlementId: s.id, kind, label: kind === 'boat' ? 'Boat evacuation' : isolated ? 'Foot access to isolated settlement' : 'Assisted evacuation', demand: evacDemand, weight: needWeight[kind] * (isolated ? 1.3 : 1), isolated });
    }
    const medical = Math.round(ex.people * def.medicalShare) + (isolated && fp.kind === 'slides' ? Math.round(s.population * k * ISOLATED_MEDICAL_SHARE) : 0);
    if (medical > 0) needs.push({ id: `${s.id}:med`, settlementId: s.id, kind: 'ambulance', label: 'Medical transfers', demand: medical, weight: needWeight.ambulance, isolated });
  }

  // ---- Unit travel ----
  const units = buildUnits(def, params);
  const travelCache = new Map<string, Trip>();
  const unitTrip = (unit: Unit, settlementId: string): Trip => {
    const key = `${unit.depotId}|${unit.type}|${settlementId}`;
    const hit = travelCache.get(key);
    if (hit) return hit;
    const s = def.settlements.find((x) => x.id === settlementId)!;
    let trip: Trip;
    if (unit.type === 'boat') trip = boatTrip(unit.coord, s.coord);
    else {
      trip = router.road(unit.coord, s.coord);
      if (!trip.feasible && unit.type === 'team' && footRouter) {
        const t = footRouter.road(unit.coord, s.coord);
        if (t.feasible) trip = { ...t, hours: t.hours + FOOT_PENALTY_H, method: 'foot-crossing', note: `${t.note} Includes ${FOOT_PENALTY_H} h to cross the blocked section on foot.` };
      }
    }
    travelCache.set(key, trip);
    return trip;
  };
  const contributionOf = (unit: Unit, need: Need): { c: number; trip: Trip } => {
    const suitable = (need.kind === 'boat' && unit.type === 'boat') || (need.kind === 'team' && unit.type === 'team') || (need.kind === 'ambulance' && unit.type === 'ambulance');
    if (!suitable) return { c: 0, trip: unitTrip(unit, need.settlementId) };
    const trip = unitTrip(unit, need.settlementId);
    if (!trip.feasible) return { c: 0, trip };
    const hours = Math.max(0, window - params.responseDelayH - trip.hours);
    return { c: unitRate(unit, trip.hours, trip.method === 'foot-crossing') * hours, trip };
  };

  // ---- Allocation ----
  const assignments: Assignment[] = [];
  const remaining = new Map(needs.map((n) => [n.id, n.demand]));
  const free = new Set(units.map((u) => u.id));
  const unitById = new Map(units.map((u) => [u.id, u]));

  if (params.strategy === 'uncoordinated') {
    // Baseline: every unit heads to the nearest affected settlement it can serve, ignoring demand already covered.
    for (const unit of units) {
      let best: { need: Need; c: number; trip: Trip } | null = null;
      for (const need of needs) {
        const { c, trip } = contributionOf(unit, need);
        if (c <= 0) continue;
        if (!best || trip.hours < best.trip.hours) best = { need, c, trip };
      }
      if (!best) continue;
      assignments.push({ unitId: unit.id, needId: best.need.id, travelH: best.trip.hours, contribution: best.c, reason: 'Baseline: went to the nearest affected settlement without coordination.', alternatives: [], source: 'baseline' });
      remaining.set(best.need.id, (remaining.get(best.need.id) ?? 0) - best.c);
      free.delete(unit.id);
    }
  } else {
    // RAAH planner: greedy — repeatedly serve the largest weighted unmet need with the suitable free unit that contributes most.
    for (let guard = 0; guard < units.length; guard++) {
      let target: Need | null = null;
      let targetScore = 0;
      for (const need of needs) {
        const rem = remaining.get(need.id)!;
        if (rem <= 0.5) continue;
        const score = rem * need.weight;
        if (score > targetScore) {
          const anyUnit = [...free].some((id) => contributionOf(unitById.get(id)!, need).c > 0);
          if (anyUnit) {
            target = need;
            targetScore = score;
          }
        }
      }
      if (!target) break;
      const candidates = [...free]
        .map((id) => ({ unit: unitById.get(id)!, ...contributionOf(unitById.get(id)!, target!) }))
        .filter((c) => c.c > 0)
        .sort((a, b) => b.c - a.c || a.trip.hours - b.trip.hours || a.unit.id.localeCompare(b.unit.id));
      const pick = candidates[0];
      const s = def.settlements.find((x) => x.id === target!.settlementId)!;
      assignments.push({
        unitId: pick.unit.id,
        needId: target.id,
        travelH: pick.trip.hours,
        contribution: pick.c,
        reason: `${s.name} had the largest weighted unmet need (${Math.round(remaining.get(target.id)!)} ${target.kind === 'ambulance' ? 'cases' : 'people'} × weight ${target.weight}). ${pick.unit.id} from ${pick.unit.depotName} adds the most capacity (${round(pick.trip.hours, 1)} h away).`,
        alternatives: candidates.slice(1, 4).map((c) => ({ unitId: c.unit.id, travelH: c.trip.hours, contribution: c.c })),
        source: 'planner',
      });
      remaining.set(target.id, remaining.get(target.id)! - pick.c);
      free.delete(pick.unit.id);
    }
  }

  // ---- Dispatcher overrides (applied on top of the automatic plan) ----
  if (manual) {
    for (const [unitId, needId] of Object.entries(manual)) {
      const unit = unitById.get(unitId);
      if (!unit) continue;
      const idx = assignments.findIndex((a) => a.unitId === unitId);
      if (idx >= 0) assignments.splice(idx, 1);
      if (!needId) continue;
      const need = needs.find((n) => n.id === needId);
      if (!need) continue;
      const { c, trip } = contributionOf(unit, need);
      if (c <= 0) continue;
      const s = def.settlements.find((x) => x.id === need.settlementId)!;
      assignments.push({ unitId, needId, travelH: trip.hours, contribution: c, reason: `Assigned manually by the dispatcher to ${s.name} (${need.label.toLowerCase()}).`, alternatives: [], source: 'manual' });
    }
  }

  // ---- Shelters ----
  const shelterCap = new Map<string, number>();
  const shelterInfo = def.shelters.map((sh) => {
    const disabled = params.disabledShelters.includes(sh.id);
    const flooded = peak.floodedShelters.includes(sh.id) || (fp.kind === 'slides' && exposureFraction(fp, sh.coord, 0.3) > 0.05);
    const capacity = Math.round((sh.capacity * params.shelterCapacityPct) / 100);
    const usable = !disabled && !flooded;
    shelterCap.set(sh.id, usable ? capacity : 0);
    return { shelter: sh, capacity, usable, reason: disabled ? 'Marked unavailable' : flooded ? 'Inside hazard footprint' : undefined };
  });
  const shelterAssignments: ShelterAssignment[] = [];
  const shelterOrder = [...settlementInfo].sort((a, b) => b.ex.fraction - a.ex.fraction || b.ex.people - a.ex.people);
  for (const { s, ex, roadAccess } of shelterOrder) {
    let need = Math.round(ex.people * def.shelterShare);
    if (need <= 0) continue;
    const options = shelterInfo
      .filter((x) => x.usable)
      .map((x) => {
        if (params.strategy === 'uncoordinated') {
          // Baseline: head to the nearest shelter by straight line regardless of capacity or closures.
          return { x, trip: { ...router.road(s.coord, x.shelter.coord), hours: haversineKm(s.coord, x.shelter.coord) } as Trip };
        }
        const road = router.road(s.coord, x.shelter.coord);
        return { x, trip: road.feasible ? road : fp.kind === 'corridor' && !roadAccess ? boatTrip(s.coord, x.shelter.coord) : road };
      })
      .sort((a, b) => a.trip.hours - b.trip.hours);
    if (params.strategy === 'uncoordinated') {
      const first = options[0];
      if (!first) continue;
      const realTrip = router.road(s.coord, first.x.shelter.coord);
      const left = shelterCap.get(first.x.shelter.id)!;
      const take = realTrip.feasible ? Math.min(left, need) : 0;
      shelterCap.set(first.x.shelter.id, left - take);
      shelterAssignments.push({ settlementId: s.id, shelterId: first.x.shelter.id, people: take, trip: realTrip });
      continue;
    }
    for (const opt of options) {
      if (need <= 0) break;
      if (!opt.trip.feasible || opt.trip.hours > MAX_SHELTER_TRIP_H) continue;
      const left = shelterCap.get(opt.x.shelter.id)!;
      if (left <= 0) continue;
      const take = Math.min(left, need);
      shelterCap.set(opt.x.shelter.id, left - take);
      need -= take;
      shelterAssignments.push({ settlementId: s.id, shelterId: opt.x.shelter.id, people: take, trip: opt.trip });
    }
  }

  // ---- Per-settlement results ----
  const servedByNeed = new Map<string, number>();
  const firstArrival = new Map<string, number>();
  for (const a of assignments) {
    servedByNeed.set(a.needId, (servedByNeed.get(a.needId) ?? 0) + a.contribution);
    const need = needs.find((n) => n.id === a.needId)!;
    const arr = params.responseDelayH + a.travelH;
    firstArrival.set(need.settlementId, Math.min(firstArrival.get(need.settlementId) ?? Infinity, arr));
  }
  const settlements: SettlementPlan[] = settlementInfo.map(({ s, ex, roadAccess, deepWater, isolated }) => {
    const evac = needs.find((n) => n.id === `${s.id}:evac`);
    const med = needs.find((n) => n.id === `${s.id}:med`);
    const served = evac ? Math.min(evac.demand, servedByNeed.get(evac.id) ?? 0) : 0;
    const medServed = med ? Math.min(med.demand, servedByNeed.get(med.id) ?? 0) : 0;
    const sa = shelterAssignments.filter((x) => x.settlementId === s.id && x.people > 0).sort((a, b) => b.people - a.people);
    return {
      settlement: s,
      exposureFraction: ex.fraction,
      exposedPeople: ex.people,
      roadAccess,
      isolated,
      deepWater,
      assistedDemand: evac?.demand ?? 0,
      medicalDemand: med?.demand ?? 0,
      shelterDemand: Math.round(ex.people * def.shelterShare),
      served: Math.round(served),
      medicalServed: Math.round(medServed),
      firstArrivalH: firstArrival.has(s.id) ? round(firstArrival.get(s.id)!, 1) : null,
      primaryShelter: sa[0] ?? null,
    };
  });

  const sum = (f: (x: SettlementPlan) => number) => settlements.reduce((acc, x) => acc + f(x), 0);
  const assistedDemand = sum((x) => x.assistedDemand);
  const served = sum((x) => x.served);
  const shelterDemand = sum((x) => x.shelterDemand);
  const sheltered = shelterAssignments.reduce((a, b) => a + b.people, 0);
  const usableCapacity = shelterInfo.filter((x) => x.usable).reduce((a, b) => a + b.capacity, 0);
  const affected = settlements.filter((x) => x.assistedDemand > 0 || x.exposedPeople > 0);
  const arrivals = affected.map((x) => x.firstArrivalH).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const routesTotal = shelterAssignments.length;
  const routesOk = shelterAssignments.filter((x) => x.trip.feasible && x.people > 0).length;

  const metrics: Metrics = {
    exposedPeople: peak.exposedPeople,
    assistedDemand,
    served,
    coveragePct: assistedDemand ? round((100 * served) / assistedDemand, 1) : 100,
    unmet: Math.max(0, assistedDemand - served),
    medicalDemand: sum((x) => x.medicalDemand),
    medicalServed: sum((x) => x.medicalServed),
    shelterDemand,
    shelterCapacity: usableCapacity,
    sheltered,
    unsheltered: Math.max(0, shelterDemand - sheltered),
    shelterUtilPct: usableCapacity ? round((100 * sheltered) / usableCapacity, 1) : 0,
    closedRoadKm: peak.closedRoadKm,
    roadCutSettlements: settlements.filter((x) => !x.roadAccess && x.exposedPeople > 0).length,
    isolatedSettlements: settlements.filter((x) => x.isolated).length,
    isolatedPeople: Math.round(settlements.filter((x) => x.isolated).reduce((a, x) => a + x.settlement.population * k, 0)),
    medianFirstArrivalH: arrivals.length ? arrivals[Math.floor(arrivals.length / 2)] : null,
    unitsDeployed: assignments.length,
    unitsTotal: units.length,
    routesFeasiblePct: routesTotal ? round((100 * routesOk) / routesTotal, 0) : 100,
  };

  // ---- Bottlenecks ----
  const bottlenecks: Bottleneck[] = [];
  const unmetBy = (kind: NeedKind) =>
    needs.filter((n) => n.kind === kind).reduce((a, n) => a + Math.max(0, n.demand - (servedByNeed.get(n.id) ?? 0)), 0);
  const boatGap = unmetBy('boat');
  const teamGap = unmetBy('team');
  const ambGap = unmetBy('ambulance');
  if (boatGap > 50) bottlenecks.push({ id: 'boats', severity: boatGap > 1000 ? 'critical' : 'warning', title: 'Boat capacity', detail: `${Math.round(boatGap).toLocaleString('en')} people in deep-water or road-cut settlements cannot be reached by boat within ${window} h.` });
  if (teamGap > 50) bottlenecks.push({ id: 'teams', severity: teamGap > 1000 ? 'critical' : 'warning', title: 'Rescue team capacity', detail: `${Math.round(teamGap).toLocaleString('en')} people needing assisted evacuation remain unserved.` });
  const isolatedMedical = fp.kind !== 'slides' ? 0 : needs.filter((n) => n.kind === 'ambulance' && n.isolated).reduce((a, n) => a + Math.max(0, n.demand - (servedByNeed.get(n.id) ?? 0)), 0);
  if (isolatedMedical > 0) bottlenecks.push({ id: 'air', severity: 'critical', title: 'Air or foot medical evacuation required', detail: `${Math.round(isolatedMedical)} medical cases are in settlements no ambulance can reach by road. Helicopter or foot evacuation is outside this model.` });
  if (ambGap - isolatedMedical > 5) bottlenecks.push({ id: 'ambulances', severity: ambGap > 50 ? 'critical' : 'warning', title: 'Medical transport', detail: `${Math.round(ambGap - isolatedMedical)} medical transfers cannot be completed — ambulances are too few or cannot reach by road.` });
  if (metrics.unsheltered > 0) bottlenecks.push({ id: 'shelter', severity: metrics.unsheltered > 5000 ? 'critical' : 'warning', title: 'Shelter capacity or access', detail: `${metrics.unsheltered.toLocaleString('en')} people seeking shelter have no reachable space.` });
  const flooded = shelterInfo.filter((x) => x.reason === 'Inside hazard footprint');
  if (flooded.length) bottlenecks.push({ id: 'flooded-shelters', severity: 'warning', title: 'Shelters inside hazard footprint', detail: flooded.map((x) => x.shelter.name).join(', ') + ' cannot be used.' });
  const cut = settlements.filter((x) => !x.roadAccess && (x.exposedPeople > 0 || fp.kind === 'slides'));
  if (cut.length) bottlenecks.push({ id: 'access', severity: 'critical', title: fp.kind === 'slides' ? 'Isolated settlements' : 'Road access cut', detail: `${cut.map((x) => x.settlement.name).join(', ')} ${cut.length === 1 ? 'has' : 'have'} no open road to any depot.` });
  if (params.responseDelayH >= 6) bottlenecks.push({ id: 'delay', severity: 'warning', title: 'Late start', detail: `A ${params.responseDelayH} h delay uses ${Math.round((100 * params.responseDelayH) / window)}% of the ${window} h response window.` });
  const idle = units.length - assignments.length;
  if (idle > 0 && assignments.length > 0) bottlenecks.push({ id: 'idle', severity: 'info', title: 'Unassigned units', detail: `${idle} unit(s) have no suitable reachable need and stay on standby.` });

  // ---- Readiness index ----
  const exposedSettlements = settlements.filter((x) => x.exposedPeople > 0 || x.isolated);
  let redundant = 0;
  for (const x of exposedSettlements) {
    const sh = x.primaryShelter;
    if (!sh || !sh.trip.feasible || sh.trip.method === 'boat') continue;
    if (sh.trip.method === 'estimated-local') {
      redundant++;
      continue;
    }
    if (hasAlternative(g, x.settlement.coord, def.shelters.find((y) => y.id === sh.shelterId)!.coord, sh.trip.edges ?? [], closed)) redundant++;
  }
  const pct = (a: number, b: number) => (b ? clamp((100 * a) / b, 0, 100) : 100);
  const components: ReadinessComponent[] = [
    { id: 'shelter', label: 'Shelter coverage', score: round(pct(sheltered, shelterDemand), 0), weight: 0.2, explanation: 'People sheltered ÷ people seeking shelter.' },
    { id: 'response', label: 'Response coverage', score: round(pct(served, assistedDemand), 0), weight: 0.2, explanation: 'People evacuated within the window ÷ people needing assisted evacuation.' },
    { id: 'redundancy', label: 'Route redundancy', score: round(pct(redundant, exposedSettlements.length), 0), weight: 0.2, explanation: 'Affected settlements with a distinct alternative road route ≤2× the best time.' },
    { id: 'timeliness', label: 'Timeliness', score: round(pct(arrivals.filter((h) => h <= FIRST_ARRIVAL_TARGET_H).length, exposedSettlements.length), 0), weight: 0.2, explanation: `Affected settlements reached by a first unit within ${FIRST_ARRIVAL_TARGET_H} h of onset.` },
    { id: 'connectivity', label: 'Road connectivity', score: round(pct(exposedSettlements.filter((x) => x.roadAccess).length, exposedSettlements.length), 0), weight: 0.2, explanation: 'Affected settlements with an open road to at least one depot.' },
  ];
  const readiness = { score: round(components.reduce((a, c) => a + c.score * c.weight, 0), 0), components };

  // ---- Time series ----
  const series: ScenarioPlan['series'] = [];
  const evacNeedsBySettlement = new Map(needs.filter((n) => n.kind !== 'ambulance').map((n) => [n.settlementId, n]));
  for (let h = 0; h <= def.durationH; h += def.durationH > 36 ? 2 : 1) {
    const st = stateAt(def, params, h);
    let demand = 0;
    let servedH = 0;
    for (const x of settlements) {
      const need = evacNeedsBySettlement.get(x.settlement.id);
      if (!need) continue;
      const ex = st.exposure.find((e) => e.id === x.settlement.id)!;
      const ratio = x.exposedPeople > 0 ? ex.people / x.exposedPeople : fp.kind === 'slides' ? (st.footprint.kind === 'slides' && st.footprint.slides.some((s) => s.active) ? 1 : 0) : 0;
      const d = need.demand * clamp(ratio, 0, 1);
      const cap = assignments
        .filter((a) => a.needId === need.id)
        .reduce((acc, a) => {
          const u = unitById.get(a.unitId)!;
          const onFoot = unitTrip(u, need.settlementId).method === 'foot-crossing';
          return acc + unitRate(u, a.travelH, onFoot) * Math.max(0, h - params.responseDelayH - a.travelH);
        }, 0);
      demand += d;
      servedH += Math.min(d, cap);
    }
    series.push({ hour: h, exposed: st.exposedPeople, demand: Math.round(demand), served: Math.round(servedH) });
  }

  // ---- Timeline ----
  const timeline: TimelineEvent[] = [];
  timeline.push({ hour: 0, kind: 'hazard', text: `Scenario onset — ${def.hazardLabel.toLowerCase()} begins to build.` });
  if (def.hazard.kind === 'landslide') {
    for (const s of def.hazard.slides) {
      if (params.slideSeverity >= s.minSeverity) timeline.push({ hour: s.activatesAtH, kind: 'closure', text: `${s.label} blocks the road.` });
    }
  } else if (fp.kind === 'corridor') {
    timeline.push({ hour: def.peakH, kind: 'hazard', text: `Hazard peaks: ${fp.magnitudeLabel}.` });
    let lastClosed = 0;
    for (let h = 2; h <= def.durationH; h += 2) {
      const n = closedEdgesFor(def, params, hazardAt(def, params, h)).size;
      if (n > lastClosed && n - lastClosed >= 3) {
        timeline.push({ hour: h, kind: 'closure', text: `${n} road segments now closed.` });
        lastClosed = n;
      }
    }
  }
  if (params.closures.length) timeline.push({ hour: 0, kind: 'closure', text: `Assumed closed from the start: ${def.closures.filter((c) => params.closures.includes(c.id)).map((c) => c.label).join('; ')}.` });
  const bySettlement = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const sid = needs.find((n) => n.id === a.needId)!.settlementId;
    bySettlement.set(sid, [...(bySettlement.get(sid) ?? []), a]);
  }
  for (const [sid, list] of bySettlement) {
    const s = def.settlements.find((x) => x.id === sid)!;
    const first = Math.min(...list.map((a) => a.travelH));
    const counts = list.reduce<Record<string, number>>((acc, a) => {
      const t = unitById.get(a.unitId)!.type;
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    const desc = Object.entries(counts).map(([t, n]) => `${n} ${t}${n > 1 ? 's' : ''}`).join(', ');
    timeline.push({ hour: params.responseDelayH, kind: 'dispatch', text: `Dispatch ${desc} to ${s.name}.` });
    timeline.push({ hour: round(params.responseDelayH + first, 1), kind: 'arrival', text: `First unit arrives at ${s.name}.` });
  }
  timeline.sort((a, b) => a.hour - b.hour);

  const dispatchTrips = assignments.map((a) => {
    const need = needs.find((n) => n.id === a.needId)!;
    return { unitId: a.unitId, settlementId: need.settlementId, trip: unitTrip(unitById.get(a.unitId)!, need.settlementId) };
  });

  return {
    engineVersion: ENGINE_VERSION,
    scenarioId: def.id,
    params,
    peak,
    current,
    units,
    needs,
    assignments,
    settlements,
    shelters: shelterInfo.map((x) => ({ ...x, assigned: shelterAssignments.filter((y) => y.shelterId === x.shelter.id).reduce((a, b) => a + b.people, 0) })),
    shelterAssignments,
    dispatchTrips,
    metrics,
    bottlenecks,
    readiness,
    series,
    timeline,
  };
}

/** Status of a unit at the scenario clock — derived, so reassignments update it immediately. */
export function unitStatus(plan: ScenarioPlan, unitId: string, hour: number): 'standby' | 'assigned' | 'en-route' | 'on-scene' {
  const a = plan.assignments.find((x) => x.unitId === unitId);
  if (!a) return 'standby';
  const start = plan.params.responseDelayH;
  if (hour < start) return 'assigned';
  if (hour < start + a.travelH) return 'en-route';
  return 'on-scene';
}
