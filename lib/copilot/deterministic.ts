/**
 * Deterministic copilot. Answers are assembled only from structured
 * application state (scenario plan, risk assessments, source registry), so
 * they cannot invent events or statistics. Used directly when no AI key is
 * configured, when offline, and as the grounding facts for the LLM path.
 */
import { assessRegion, HAZARD_LABELS } from '@/lib/risk/engine';
import { REGIONS } from '@/lib/data/regions';
import { SOURCES } from '@/lib/data/sources';
import { computePlan, type ScenarioPlan } from '@/lib/scenario/engine';
import type { ScenarioDefinition, ScenarioParams } from '@/lib/scenario/types';
import type { HazardType } from '@/lib/domain/types';

export type FactKind = 'verified' | 'estimate' | 'assumption' | 'advice';

export interface Fact {
  id: string;
  kind: FactKind;
  text: string;
}

export interface CopilotAnswer {
  intent: Intent;
  title: string;
  summary: string;
  facts: Fact[];
  uncertainty: string;
  followUps: string[];
  source: 'deterministic' | 'qwen';
  model?: string;
  narrative?: string;
  notice?: string;
}

export type Intent = 'why-plan' | 'what-if-boats' | 'what-if-delay' | 'shelter' | 'assumptions' | 'risk-region' | 'bottlenecks' | 'routes' | 'data' | 'prepare' | 'help';

const n = (x: number) => Math.round(x).toLocaleString('en');

export function detectIntent(question: string): { intent: Intent; regionId?: string; hazard?: HazardType } {
  const q = question.toLowerCase();
  const region = REGIONS.find((r) => q.includes(r.name.toLowerCase().split(' ')[0]) || q.includes(r.id));
  const hazard: HazardType | undefined = /earthquake|zalzala|seismic/.test(q)
    ? 'earthquake'
    : /heat|garmi|temperature/.test(q)
      ? 'heatwave'
      : /landslide|slide/.test(q)
        ? 'landslide'
        : /urban|nullah|drain/.test(q)
          ? 'urban_flood'
          : /flood|selab|sailab|river/.test(q)
            ? 'flood'
            : undefined;
  if (/(risk|khatra|danger).*(why|kyun|high|marked)|why.*(risk|high)/.test(q) && region) return { intent: 'risk-region', regionId: region.id, hazard };
  if (/boat/.test(q) && /(reduce|fewer|less|half|cut|kam|more|increase|add|double)/.test(q)) return { intent: 'what-if-boats' };
  if (/(delay|late|early|earlier|sooner|der)/.test(q)) return { intent: 'what-if-delay' };
  if (/shelter|camp|capacity/.test(q)) return { intent: 'shelter' };
  if (/assum|model|how.*calculat|methodolog/.test(q)) return { intent: 'assumptions' };
  if (/bottleneck|problem|gap|shortfall|unmet/.test(q)) return { intent: 'bottlenecks' };
  if (/route|road|evacuat.*path|closure|bridge/.test(q)) return { intent: 'routes' };
  if (/data|source|real|simulat|live|fake|verified/.test(q)) return { intent: 'data' };
  if (/prepar|kit|what should i|advice|tayyari/.test(q)) return { intent: 'prepare', hazard };
  if (/why|recommend|plan|allocat|dispatch|explain/.test(q)) return { intent: 'why-plan' };
  if (region) return { intent: 'risk-region', regionId: region.id, hazard };
  return { intent: 'help' };
}

const ASSUMPTION_NOTE = 'Scenario outputs are simulations from documented assumptions — not observed disaster data or official forecasts.';

export function answerQuestion(question: string, def: ScenarioDefinition, params: ScenarioParams, planIn?: ScenarioPlan): CopilotAnswer {
  const { intent, regionId, hazard } = detectIntent(question);
  const plan = planIn ?? computePlan(def, params);
  const m = plan.metrics;
  const base = { intent, source: 'deterministic' as const };

  switch (intent) {
    case 'why-plan': {
      const top = [...plan.settlements].sort((a, b) => b.assistedDemand - a.assistedDemand).slice(0, 3);
      const byType = plan.assignments.reduce<Record<string, number>>((acc, a) => {
        const t = plan.units.find((u) => u.id === a.unitId)!.type;
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {});
      const baseline = computePlan(def, { ...params, strategy: 'uncoordinated' });
      return {
        ...base,
        title: 'Why this response plan was recommended',
        summary: `The planner serves the largest weighted unmet needs first and, for each, picks the free suitable unit that adds the most capacity within the ${def.durationH} h window. Against an uncoordinated nearest-first baseline it covers ${m.coveragePct}% vs ${baseline.metrics.coveragePct}% of assisted-evacuation demand and shelters ${n(m.sheltered)} vs ${n(baseline.metrics.sheltered)} people.`,
        facts: [
          { id: 'f1', kind: 'estimate', text: `Peak exposure ${n(m.exposedPeople)} people; ${n(m.assistedDemand)} need assisted evacuation.` },
          ...top.map((s, i) => ({ id: `f-top-${i}`, kind: 'estimate' as const, text: `${s.settlement.name}: ${n(s.assistedDemand)} people need help${s.deepWater ? ' (deep water — boats required)' : ''}${!s.roadAccess ? ' (no road access)' : ''}; ${n(s.served)} served.` })),
          { id: 'f-units', kind: 'estimate', text: `Deployed ${Object.entries(byType).map(([t, c]) => `${c} ${t}s`).join(', ')} of ${m.unitsTotal} units.` },
          { id: 'f-rule', kind: 'assumption', text: 'Priority weights: medical 2.0, boat evacuation 1.5, land evacuation 1.0 (×1.3 for isolated settlements).' },
          { id: 'f-rates', kind: 'assumption', text: 'Unit rates: boat 6.7 people/h, rescue team 15 people/h, ambulance one case per round trip + 45 min.' },
          { id: 'f-delay', kind: 'assumption', text: `Response delay ${params.responseDelayH} h before units move.` },
        ],
        uncertainty: `${ASSUMPTION_NOTE} A greedy heuristic is not guaranteed optimal; it is deterministic and auditable.`,
        followUps: ['What changes if rescue boats are reduced?', 'What are the main bottlenecks?', 'Which shelter has capacity?'],
      };
    }
    case 'what-if-boats':
    case 'what-if-delay': {
      const alt: ScenarioParams =
        intent === 'what-if-boats'
          ? { ...params, boats: /more|increase|add|double/.test(question.toLowerCase()) ? Math.min(params.boats * 2, 80) : Math.floor(params.boats / 2) }
          : { ...params, responseDelayH: /early|earlier|sooner|reduce|less/.test(question.toLowerCase()) ? Math.max(0, params.responseDelayH - 4) : params.responseDelayH + 6 };
      const p2 = computePlan(def, alt);
      const label = intent === 'what-if-boats' ? `boats ${params.boats} → ${alt.boats}` : `response delay ${params.responseDelayH} h → ${alt.responseDelayH} h`;
      return {
        ...base,
        title: `What-if: ${label}`,
        summary: `Re-running the same scenario with ${label}: coverage ${m.coveragePct}% → ${p2.metrics.coveragePct}%, unmet assisted evacuation ${n(m.unmet)} → ${n(p2.metrics.unmet)} people, readiness index ${plan.readiness.score} → ${p2.readiness.score}.`,
        facts: [
          { id: 'f1', kind: 'estimate', text: `Current: ${m.coveragePct}% coverage, ${n(m.served)} served, median first arrival ${m.medianFirstArrivalH ?? '—'} h.` },
          { id: 'f2', kind: 'estimate', text: `Alternative: ${p2.metrics.coveragePct}% coverage, ${n(p2.metrics.served)} served, median first arrival ${p2.metrics.medianFirstArrivalH ?? '—'} h.` },
          { id: 'f3', kind: 'estimate', text: `Medical transfers completed: ${n(m.medicalServed)} → ${n(p2.metrics.medicalServed)}.` },
          { id: 'f4', kind: 'assumption', text: 'Everything else (hazard, populations, shelters, closures) is held constant.' },
        ],
        uncertainty: `${ASSUMPTION_NOTE} These are operational proxies (coverage, timing); the model does not estimate lives saved.`,
        followUps: ['Why was this response plan recommended?', 'What are the main bottlenecks?'],
      };
    }
    case 'shelter': {
      const rows = [...plan.shelters].sort((a, b) => b.capacity - b.assigned - (a.capacity - a.assigned));
      return {
        ...base,
        title: 'Shelter capacity in this simulation',
        summary: `${n(m.sheltered)} of ${n(m.shelterDemand)} people seeking shelter are placed (${m.shelterUtilPct}% of usable capacity). ${rows.filter((r) => r.usable && r.capacity - r.assigned > 0).length} shelter(s) still have space.`,
        facts: rows.map((r, i) => ({
          id: `sh-${i}`,
          kind: 'estimate' as const,
          text: r.usable ? `${r.shelter.name}: ${n(r.assigned)} / ${n(r.capacity)} placed, ${n(r.capacity - r.assigned)} free.` : `${r.shelter.name}: unusable — ${r.reason?.toLowerCase()}.`,
        })),
        uncertainty: `${ASSUMPTION_NOTE} Shelter sites and capacities are illustrative, not a verified shelter registry.`,
        followUps: ['What are the main bottlenecks?', 'How does routing work?'],
      };
    }
    case 'assumptions':
      return {
        ...base,
        title: `Major assumptions — ${def.shortTitle}`,
        summary: 'Every scenario number derives from these documented assumptions plus Natural Earth geometry. Change them with the simulator controls to see their effect.',
        facts: def.assumptions.map((a, i) => ({ id: `a-${i}`, kind: 'assumption' as const, text: a })),
        uncertainty: 'Hazard footprints are illustrative and not hydraulically or geotechnically modelled.',
        followUps: ['Which data is real and which is simulated?', 'Why was this response plan recommended?'],
      };
    case 'bottlenecks':
      return {
        ...base,
        title: 'Key bottlenecks',
        summary: plan.bottlenecks.length ? `${plan.bottlenecks.filter((b) => b.severity === 'critical').length} critical and ${plan.bottlenecks.filter((b) => b.severity === 'warning').length} warning-level bottlenecks under the current settings.` : 'No bottlenecks under the current settings.',
        facts: plan.bottlenecks.map((b) => ({ id: b.id, kind: 'estimate' as const, text: `${b.title}: ${b.detail}` })),
        uncertainty: ASSUMPTION_NOTE,
        followUps: ['What changes if rescue boats are reduced?', 'What if the response starts earlier?'],
      };
    case 'routes':
      return {
        ...base,
        title: 'How routes and closures are computed',
        summary: `Routes use Dijkstra’s shortest-path algorithm over a road graph built from Natural Earth major roads. In this scenario ${n(m.closedRoadKm)} km of road segments are closed by the hazard footprint${params.closures.length ? ' and manual closures' : ''}.`,
        facts: [
          { id: 'r1', kind: 'verified', text: 'Road geometry: Natural Earth 1:10m roads (public domain), ~4,250 nodes.' },
          { id: 'r2', kind: 'assumption', text: 'Speeds: 70 km/h major highways, 45 km/h other roads, 30 km/h access legs.' },
          { id: 'r3', kind: 'assumption', text: 'Trips under 15 km are estimated as 1.35× straight line (the graph has no local streets).' },
          { id: 'r4', kind: 'estimate', text: `${m.routesFeasiblePct}% of planned shelter trips have a feasible route.` },
          { id: 'r5', kind: 'advice', text: 'These are not navigation instructions. Follow official directions and road status updates.' },
        ],
        uncertainty: 'The road network is generalised; real closures depend on site conditions.',
        followUps: ['Which shelter has capacity?', 'What are the major assumptions?'],
      };
    case 'data':
      return {
        ...base,
        title: 'Which data is real and which is simulated',
        summary: 'RAAH labels every value as LIVE, HISTORICAL, ESTIMATED, ASSUMPTION or SIMULATED. Live feeds are never silently replaced with synthetic numbers.',
        facts: SOURCES.map((s) => ({ id: s.id, kind: (s.mode === 'simulated' || s.mode === 'assumption' ? 'assumption' : 'verified') as FactKind, text: `${s.name} — ${s.mode.toUpperCase()}. ${s.limitations}` })),
        uncertainty: 'Live sources depend on third-party availability; when unavailable they are shown as UNAVAILABLE.',
        followUps: ['What are the major assumptions?', 'How does routing work?'],
      };
    case 'risk-region': {
      const region = REGIONS.find((r) => r.id === regionId)!;
      const hz = hazard ?? 'flood';
      const a = assessRegion(region, hz);
      return {
        ...base,
        title: `Why ${region.name} is rated ${a.riskBand} for ${HAZARD_LABELS[hz].toLowerCase()}`,
        summary: `Risk score ${a.riskScore}/100 = 100 × (H/10)^0.5 × (E/10)^0.3 × (A/10)^0.2 with hazard ${a.hazardScore}, exposure ${a.exposureScore}, access constraint ${a.accessScore}.`,
        facts: [
          ...a.factors.map((f) => ({ id: f.id, kind: (f.mode === 'historical' ? 'verified' : f.mode === 'assumption' ? 'assumption' : 'estimate') as FactKind, text: `${f.label}: ${f.value} → ${f.score}/10. ${f.explanation}` })),
          ...a.actions.map((x, i) => ({ id: `act-${i}`, kind: 'advice' as const, text: x })),
        ],
        uncertainty: a.uncertainty,
        followUps: ['Which data is real and which is simulated?', 'What are the major assumptions?'],
      };
    }
    case 'prepare':
      return {
        ...base,
        title: 'Preparedness guidance',
        summary: 'General preparedness steps. In an emergency call Rescue 1122 (or Police 15) and follow PDMA/NDMA instructions.',
        facts: [
          { id: 'p1', kind: 'advice', text: 'Keep a grab bag: drinking water, medicines, torch, power bank, cash, copies of CNIC and documents.' },
          { id: 'p2', kind: 'advice', text: 'Know the nearest higher ground and two ways to reach it.' },
          { id: 'p3', kind: 'advice', text: 'Never walk or drive through moving flood water.' },
          { id: 'p4', kind: 'advice', text: 'Follow official PDMA, NDMA and PMD alerts; RAAH does not issue alerts.' },
        ],
        uncertainty: 'General guidance; local authorities’ instructions take priority.',
        followUps: ['Which shelter has capacity?', 'Which data is real and which is simulated?'],
      };
    default:
      return {
        ...base,
        title: 'What I can explain',
        summary: 'I answer from the application’s structured data. Try one of these questions.',
        facts: [
          { id: 'h1', kind: 'advice', text: 'Why was this response plan recommended?' },
          { id: 'h2', kind: 'advice', text: 'What changes if rescue boats are reduced?' },
          { id: 'h3', kind: 'advice', text: 'Which shelter has available capacity?' },
          { id: 'h4', kind: 'advice', text: 'Why is Rajanpur marked high risk for floods?' },
          { id: 'h5', kind: 'advice', text: 'What are the major assumptions in this model?' },
        ],
        uncertainty: 'I do not have access to live incident reports and will not invent them.',
        followUps: ['Why was this response plan recommended?', 'What are the major assumptions?'],
      };
  }
}
