import { z } from 'zod';
import { SCENARIOS, scenarioById, DEFAULT_SCENARIO } from './definitions';
import type { ScenarioDefinition, ScenarioParams } from './types';

/**
 * Shareable scenario links. Only scenario parameters are encoded — never
 * dispatcher notes, SOS reports or anything personal.
 */
const KEYS: Record<string, keyof ScenarioParams> = {
  rise: 'riverRiseM',
  rain: 'rainfallMm',
  sev: 'slideSeverity',
  boats: 'boats',
  teams: 'teams',
  amb: 'ambulances',
  shel: 'shelterCapacityPct',
  dem: 'demandPct',
  delay: 'responseDelayH',
  bridge: 'bridgeCloseM',
  t: 'hour',
};

const num = z.coerce.number().finite();

export function clampParams(def: ScenarioDefinition, p: ScenarioParams): ScenarioParams {
  const out: ScenarioParams = { ...p };
  for (const c of def.controls) {
    const v = out[c.key] as number;
    (out[c.key] as number) = Math.min(c.max, Math.max(c.min, Math.round(v / c.step) * c.step));
  }
  out.hour = Math.min(def.durationH, Math.max(0, Math.round(out.hour)));
  out.closures = out.closures.filter((id) => def.closures.some((c) => c.id === id));
  out.disabledShelters = out.disabledShelters.filter((id) => def.shelters.some((s) => s.id === id));
  out.strategy = out.strategy === 'uncoordinated' ? 'uncoordinated' : 'coordinated';
  return out;
}

export function encodeScenario(def: ScenarioDefinition, p: ScenarioParams): string {
  const q = new URLSearchParams();
  q.set('s', def.id);
  for (const [k, key] of Object.entries(KEYS)) {
    if (p[key] !== def.defaults[key]) q.set(k, String(p[key]));
  }
  if (p.closures.length) q.set('close', p.closures.join(','));
  if (p.disabledShelters.length) q.set('off', p.disabledShelters.join(','));
  if (p.strategy !== 'coordinated') q.set('mode', 'baseline');
  return q.toString();
}

export function decodeScenario(search: string | URLSearchParams): { def: ScenarioDefinition; params: ScenarioParams } {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const def = scenarioById(q.get('s') ?? '') ?? DEFAULT_SCENARIO;
  const params: ScenarioParams = { ...def.defaults, closures: [...def.defaults.closures], disabledShelters: [...def.defaults.disabledShelters] };
  for (const [k, key] of Object.entries(KEYS)) {
    const raw = q.get(k);
    if (raw === null) continue;
    const parsed = num.safeParse(raw);
    if (parsed.success) (params[key] as number) = parsed.data;
  }
  const list = (v: string | null) => (v ? v.split(',').map((x) => x.trim()).filter((x) => /^[a-z0-9-]{1,40}$/.test(x)) : []);
  params.closures = list(q.get('close'));
  params.disabledShelters = list(q.get('off'));
  params.strategy = q.get('mode') === 'baseline' ? 'uncoordinated' : 'coordinated';
  return { def, params: clampParams(def, params) };
}

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
