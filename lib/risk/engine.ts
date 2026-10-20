/**
 * Explainable multi-hazard risk screening index (model version below).
 *
 *   risk = 100 · (H/10)^0.5 · (E/10)^0.3 · (A/10)^0.2
 *
 * H = hazard (0–10), E = exposure (0–10), A = access constraint (0–10, higher = harder to reach).
 * A weighted geometric mean (INFORM-style) so that a zero hazard yields zero risk.
 * Bands: <30 low · 30–50 moderate · 50–70 high · ≥70 critical.
 *
 * This is a relative screening index for prioritisation discussions. It is not
 * a forecast and has not been validated against observed losses.
 */
import type { HazardType, RiskAssessment, RiskBand, RiskFactor } from '@/lib/domain/types';
import { REGIONS, type RegionWithWaterways } from '@/lib/data/regions';
import { HISTORICAL_EVENTS } from '@/lib/data/historical';
import { getRoadGraph, riverLines } from '@/lib/geo/data';
import { clamp, haversineKm, pointToLinesKm, round } from '@/lib/geo/geometry';
import { nearestNode } from '@/lib/geo/graph';

export const RISK_MODEL_VERSION = 'raah-risk-1.0';

export const HAZARD_LABELS: Record<HazardType, string> = {
  flood: 'Riverine flood',
  urban_flood: 'Urban flooding',
  earthquake: 'Earthquake',
  heatwave: 'Heatwave',
  landslide: 'Landslide',
};

/** Live inputs (from lib/providers) — absent when the provider is unavailable. */
export interface LiveInputs {
  /** 3-day precipitation sum, mm */
  rain3dMm?: number;
  /** max of daily max temperature over 3 days, °C */
  tmax3dC?: number;
  retrievedAt?: string;
}

export function bandFor(score: number): RiskBand {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

export function combine(h: number, e: number, a: number): number {
  const s = 100 * Math.pow(h / 10, 0.5) * Math.pow(e / 10, 0.3) * Math.pow(Math.max(a, 0.5) / 10, 0.2);
  return round(clamp(s, 0, 100), 0);
}

const eventsFor = (r: RegionWithWaterways, hazard: HazardType) =>
  HISTORICAL_EVENTS.filter((e) => e.hazard === hazard && r.historicalEvents.includes(e.id));

function historicalFactor(r: RegionWithWaterways, hazard: HazardType): RiskFactor {
  const evs = eventsFor(r, hazard);
  const score = evs.length === 0 ? 0 : evs.length === 1 ? 6 : 9;
  return {
    id: 'historical',
    label: 'Historical record',
    dimension: 'hazard',
    score,
    value: evs.length ? evs.map((e) => `${e.title}`).join('; ') : 'No event in curated list',
    mode: 'historical',
    sourceIds: ['raah-historical'],
    explanation: '0 events → 0, 1 event → 6, 2+ events → 9 (curated list, not a complete catalogue).',
  };
}

function rainFactor(live: LiveInputs | undefined, divisor: number): RiskFactor {
  if (live?.rain3dMm === undefined) {
    return {
      id: 'live-rain',
      label: '3-day rainfall forecast',
      dimension: 'hazard',
      score: 0,
      value: 'Live forecast unavailable — factor excluded, weights re-normalised',
      mode: 'unavailable',
      sourceIds: ['open-meteo'],
      explanation: 'Only used when the Open-Meteo request succeeds. Never replaced with synthetic values.',
    };
  }
  return {
    id: 'live-rain',
    label: '3-day rainfall forecast',
    dimension: 'hazard',
    score: round(clamp(live.rain3dMm / divisor, 0, 10), 1),
    value: `${round(live.rain3dMm, 1)} mm forecast (retrieved ${live.retrievedAt ?? 'n/a'})`,
    mode: 'live',
    sourceIds: ['open-meteo'],
    explanation: `score = min(10, mm ÷ ${divisor}). Model forecast, not an official PMD warning.`,
  };
}

/** Weighted average that drops unavailable factors and re-normalises the remaining weights. */
function weighted(parts: [RiskFactor, number][]): number {
  const usable = parts.filter(([f]) => f.mode !== 'unavailable');
  const wsum = usable.reduce((s, [, w]) => s + w, 0) || 1;
  return round(usable.reduce((s, [f, w]) => s + f.score * w, 0) / wsum, 2);
}

function hazardFactors(r: RegionWithWaterways, hazard: HazardType, live?: LiveInputs): { score: number; factors: RiskFactor[] } {
  switch (hazard) {
    case 'flood': {
      const d = pointToLinesKm(r.coord, riverLines());
      const computed = round(10 * Math.exp(-d / 15), 1);
      const local = r.localWaterways;
      const useLocal = local && local.analystProximityScore > computed;
      const prox: RiskFactor = useLocal
        ? {
            id: 'river-proximity',
            label: 'River proximity',
            dimension: 'hazard',
            score: local!.analystProximityScore,
            value: `${local!.name} (not in Natural Earth); main-stem river ${round(d, 1)} km`,
            mode: 'assumption',
            sourceIds: ['raah-analyst', 'ne-rivers'],
            explanation: 'Analyst score used because the local waterway is missing from the 1:10m dataset.',
          }
        : {
            id: 'river-proximity',
            label: 'River proximity',
            dimension: 'hazard',
            score: computed,
            value: `${round(d, 1)} km to nearest main-stem river`,
            mode: 'estimated',
            sourceIds: ['ne-rivers'],
            explanation: 'score = 10·e^(−d/15 km), computed from Natural Earth river centrelines.',
          };
      const hist = historicalFactor(r, 'flood');
      const rain = rainFactor(live, 15);
      return { score: weighted([[prox, 0.4], [hist, 0.35], [rain, 0.25]]), factors: [prox, hist, rain] };
    }
    case 'urban_flood': {
      const imperv: RiskFactor = {
        id: 'urban-surface',
        label: 'Urban surface proxy',
        dimension: 'hazard',
        score: r.sizeClass * 2,
        value: `City size class ${r.sizeClass}/5`,
        mode: 'assumption',
        sourceIds: ['raah-analyst'],
        explanation: 'Larger cities have more sealed surface and drainage bottlenecks. score = 2 × size class.',
      };
      const local: RiskFactor = {
        id: 'nullah',
        label: 'Urban drainage channel',
        dimension: 'hazard',
        score: r.localWaterways?.analystProximityScore ?? 2,
        value: r.localWaterways?.name ?? 'No major urban nullah recorded',
        mode: 'assumption',
        sourceIds: ['raah-analyst'],
        explanation: 'Analyst proximity score for named urban channels.',
      };
      const hist = historicalFactor(r, 'urban_flood');
      const rain = rainFactor(live, 10);
      return { score: weighted([[imperv, 0.3], [local, 0.25], [hist, 0.2], [rain, 0.25]]), factors: [imperv, local, hist, rain] };
    }
    case 'earthquake': {
      const quakes = HISTORICAL_EVENTS.filter((e) => e.hazard === 'earthquake' && e.magnitude);
      const contribs = quakes
        .map((q) => {
          const d = haversineKm(r.coord, q.coord);
          return { q, d, c: (q.magnitude! - 5) * 2.5 * Math.exp(-d / 200) };
        })
        .sort((a, b) => b.c - a.c);
      const top = contribs[0];
      const second = contribs[1]?.c ?? 0;
      const score = round(clamp((top.c + 0.3 * second) * 1.4, 0, 10), 1);
      const f: RiskFactor = {
        id: 'seismic-proximity',
        label: 'Historical seismicity proximity',
        dimension: 'hazard',
        score,
        value: `${round(top.d, 0)} km from ${top.q.title} (M${top.q.magnitude})`,
        mode: 'estimated',
        sourceIds: ['raah-historical'],
        explanation:
          'Σ (M−5)·2.5·e^(−d/200 km) over the two strongest contributors (×1.4, capped at 10). A proxy only — the authoritative reference is the Building Code of Pakistan seismic zoning / PSHA.',
      };
      return { score, factors: [f] };
    }
    case 'heatwave': {
      const clim: RiskFactor = {
        id: 'heat-class',
        label: 'Climatological heat class',
        dimension: 'hazard',
        score: r.heatClass * 3,
        value: `Class ${r.heatClass}/3`,
        mode: 'assumption',
        sourceIds: ['raah-analyst'],
        explanation: 'Analyst class pending PMD climate normals. score = 3 × class.',
      };
      const hist = historicalFactor(r, 'heatwave');
      const t: RiskFactor =
        live?.tmax3dC === undefined
          ? { id: 'live-tmax', label: '3-day max temperature forecast', dimension: 'hazard', score: 0, value: 'Live forecast unavailable — factor excluded', mode: 'unavailable', sourceIds: ['open-meteo'], explanation: 'Only used when the Open-Meteo request succeeds.' }
          : { id: 'live-tmax', label: '3-day max temperature forecast', dimension: 'hazard', score: round(clamp((live.tmax3dC - 35) * 0.8, 0, 10), 1), value: `${round(live.tmax3dC, 1)} °C forecast max`, mode: 'live', sourceIds: ['open-meteo'], explanation: 'score = clamp((T − 35 °C) × 0.8, 0, 10).' };
      return { score: weighted([[clim, 0.5], [hist, 0.2], [t, 0.3]]), factors: [clim, hist, t] };
    }
    case 'landslide': {
      const terrainScore = r.terrain === 'mountain' ? 8 : r.terrain === 'foothill' ? 4 : 0.5;
      const terr: RiskFactor = {
        id: 'terrain',
        label: 'Terrain class',
        dimension: 'hazard',
        score: terrainScore,
        value: r.terrain,
        mode: 'assumption',
        sourceIds: ['raah-analyst'],
        explanation: 'mountain 8 · foothill 4 · other 0.5. A slope/geology model would replace this.',
      };
      const hist = historicalFactor(r, 'landslide');
      const rain = rainFactor(live, 12);
      return { score: weighted([[terr, 0.55], [hist, 0.2], [rain, 0.25]]), factors: [terr, hist, rain] };
    }
  }
}

function exposureFactor(r: RegionWithWaterways): RiskFactor {
  return {
    id: 'size-class',
    label: 'Population exposure (size class)',
    dimension: 'exposure',
    score: r.sizeClass * 2,
    value: `Size class ${r.sizeClass}/5`,
    mode: 'assumption',
    sourceIds: ['raah-analyst', 'ne-places'],
    explanation: 'Analyst class: 1 town … 5 megacity. Census-based gridded population would replace this.',
  };
}

/** Access constraint computed from the road graph: distance to network and nearby network density. */
export function accessFactor(r: RegionWithWaterways): RiskFactor {
  const g = getRoadGraph();
  const snap = nearestNode(g, r.coord);
  let nearby = 0;
  for (const e of g.edges) {
    const a = g.nodes[e.a];
    if (Math.abs(a[1] - r.coord[1]) > 0.35 || Math.abs(a[0] - r.coord[0]) > 0.4) continue;
    if (haversineKm(r.coord, a) <= 30) nearby++;
  }
  const score = round(clamp(10 - nearby / 6 + snap.km / 2 + (r.terrain === 'mountain' ? 2 : 0), 0.5, 10), 1);
  return {
    id: 'road-access',
    label: 'Road access constraint',
    dimension: 'access',
    score,
    value: `${nearby} road segments within 30 km; ${round(snap.km, 1)} km to network${r.terrain === 'mountain' ? '; mountain terrain' : ''}`,
    mode: 'estimated',
    sourceIds: ['ne-roads'],
    explanation: 'score = 10 − segments/6 + snapKm/2 (+2 mountain), clamped 0.5–10. Higher = harder to reach.',
  };
}

const ACTIONS: Record<HazardType, Record<RiskBand, string[]>> = {
  flood: {
    low: ['Keep drainage clear and monitor PDMA/PMD advisories during the monsoon.'],
    moderate: ['Pre-identify higher ground and shelters for riverine (kacha) settlements.', 'Check embankment and spur condition before peak flows.'],
    high: ['Pre-position boats and rescue teams near riverine settlements.', 'Prepare shelter capacity and early-warning messaging in Urdu and local languages.'],
    critical: ['Begin staged evacuation planning for kacha areas.', 'Confirm bridge and road status; plan alternate access routes.', 'Coordinate shelter, medical and relief stock with district authorities.'],
  },
  urban_flood: {
    low: ['Routine drain cleaning before the monsoon.'],
    moderate: ['Clear nullah encroachments and blockages; map underpasses that flood.'],
    high: ['Pre-position dewatering pumps and rescue teams at known hotspots.', 'Plan traffic diversions away from low-lying roads.'],
    critical: ['Issue public advisories to avoid nullah banks and underpasses.', 'Prepare evacuation of low-lying neighbourhoods along drainage channels.'],
  },
  earthquake: {
    low: ['Promote basic household earthquake safety (drop, cover, hold on).'],
    moderate: ['Check compliance of schools and hospitals with the Building Code of Pakistan.'],
    high: ['Run search-and-rescue drills; stock heavy-rescue equipment.', 'Identify open spaces for post-quake shelter.'],
    critical: ['Prioritise retrofitting of critical facilities.', 'Pre-plan mass-casualty medical surge and shelter for winter conditions.'],
  },
  heatwave: {
    low: ['Share basic heat-illness guidance.'],
    moderate: ['Plan cooling points and drinking-water access in public places.'],
    high: ['Activate heat-health action plan: hospital readiness, water points, outreach to outdoor workers.'],
    critical: ['Coordinate power-supply priority for hospitals; open cooling centres; protect elderly and outdoor workers.'],
  },
  landslide: {
    low: ['Monitor slopes near roads after heavy rain.'],
    moderate: ['Map slide-prone road sections and keep machinery on standby.'],
    high: ['Pre-position road-clearing machinery and relief stocks on both sides of vulnerable sections.'],
    critical: ['Restrict travel during intense rainfall; plan air or alternate-route access to isolated valleys.'],
  },
};

export function assessRegion(r: RegionWithWaterways, hazard: HazardType, live?: LiveInputs, now = new Date()): RiskAssessment {
  const hz = hazardFactors(r, hazard, live);
  const exp = exposureFactor(r);
  const acc = accessFactor(r);
  const score = combine(hz.score, exp.score, acc.score);
  const band = bandFor(score);
  const factors = [...hz.factors, exp, acc];
  return {
    id: `${r.id}:${hazard}`,
    hazard,
    regionId: r.id,
    assessedAt: now.toISOString(),
    riskScore: score,
    riskBand: band,
    hazardScore: hz.score,
    exposureScore: exp.score,
    accessScore: acc.score,
    factors,
    uncertainty:
      'Relative screening index combining computed geometry, curated historical records and analyst classes. Not validated against observed losses; differences under ~10 points should not be over-interpreted.',
    assumptions: [
      'Weights: hazard 0.5, exposure 0.3, access 0.2 (weighted geometric mean).',
      'Analyst classes (size, heat, terrain, local waterways) are documented assumptions.',
      'Unavailable live factors are excluded, never simulated.',
    ],
    actions: ACTIONS[hazard][band],
    sourceIds: [...new Set(factors.flatMap((f) => f.sourceIds))],
    mode: 'estimated',
    modelVersion: RISK_MODEL_VERSION,
  };
}

export function assessAll(hazard: HazardType, live: Record<string, LiveInputs> = {}, now = new Date()): RiskAssessment[] {
  return REGIONS.map((r) => assessRegion(r, hazard, live[r.id], now)).sort((a, b) => b.riskScore - a.riskScore);
}
