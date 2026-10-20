import { describe, expect, it } from 'vitest';
import { decodeScenario, encodeScenario } from '@/lib/scenario/url';
import { scenarioById, DEFAULT_SCENARIO } from '@/lib/scenario/definitions';

describe('shareable scenario links', () => {
  it('round-trips parameters', () => {
    const def = scenarioById('south-punjab-flood')!;
    const p = { ...def.defaults, boats: 33, responseDelayH: 3, closures: ['chenab-bridge'], disabledShelters: ['sh-dgk'], strategy: 'uncoordinated' as const, hour: 12 };
    const q = encodeScenario(def, p);
    const back = decodeScenario(q);
    expect(back.def.id).toBe(def.id);
    expect(back.params).toEqual(p);
  });
  it('omits defaults to keep links short', () => {
    expect(encodeScenario(DEFAULT_SCENARIO, DEFAULT_SCENARIO.defaults)).toBe(`s=${DEFAULT_SCENARIO.id}`);
  });
  it('clamps out-of-range and rejects junk values', () => {
    const { params } = decodeScenario('s=south-punjab-flood&boats=99999&delay=-5&rise=abc&close=chenab-bridge,<script>,unknown');
    expect(params.boats).toBe(60);
    expect(params.responseDelayH).toBe(0);
    expect(params.riverRiseM).toBe(scenarioById('south-punjab-flood')!.defaults.riverRiseM);
    expect(params.closures).toEqual(['chenab-bridge']);
  });
  it('falls back to the default scenario for unknown ids', () => {
    expect(decodeScenario('s=does-not-exist').def.id).toBe(DEFAULT_SCENARIO.id);
  });
});
