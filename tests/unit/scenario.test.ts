import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioById } from '@/lib/scenario/definitions';
import { buildUnits, computePlan, distribute, exposureFraction, hazardAt, intensityAt, MAX_SHELTER_TRIP_H, stateAt, unitStatus } from '@/lib/scenario/engine';

const flood = scenarioById('south-punjab-flood')!;
const urban = scenarioById('twin-cities-urban-flood')!;
const slide = scenarioById('kohistan-landslide')!;

describe('scenario clock and hazard', () => {
  it('intensity rises monotonically to 1 at the peak and holds', () => {
    let prev = -1;
    for (let h = 0; h <= flood.durationH; h++) {
      const i = intensityAt(flood, h);
      expect(i).toBeGreaterThanOrEqual(prev);
      prev = i;
    }
    expect(intensityAt(flood, 0)).toBe(0);
    expect(intensityAt(flood, flood.peakH)).toBe(1);
    expect(intensityAt(flood, flood.durationH)).toBe(1);
  });
  it('higher river rise widens the corridor, exposes more people and closes more roads', () => {
    const lo = stateAt(flood, { ...flood.defaults, riverRiseM: 2 }, flood.durationH);
    const hi = stateAt(flood, { ...flood.defaults, riverRiseM: 4.5 }, flood.durationH);
    expect(hazardAt(flood, { ...flood.defaults, riverRiseM: 4.5 }, 72).kind).toBe('corridor');
    expect(hi.exposedPeople).toBeGreaterThan(lo.exposedPeople);
    expect(hi.closedEdges.length).toBeGreaterThanOrEqual(lo.closedEdges.length);
  });
  it('no hazard means no exposure and no closures', () => {
    const s = stateAt(flood, { ...flood.defaults, riverRiseM: 0 }, flood.durationH);
    expect(s.exposedPeople).toBe(0);
    expect(s.closedEdges).toHaveLength(0);
  });
  it('exposure fraction is bounded 0..1', () => {
    const fp = hazardAt(flood, { ...flood.defaults, riverRiseM: 6 }, 72);
    for (const s of flood.settlements) {
      const f = exposureFraction(fp, s.coord, 2);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('urban rainfall below drainage capacity causes no flooding', () => {
    expect(stateAt(urban, { ...urban.defaults, rainfallMm: 50 }, urban.durationH).exposedPeople).toBe(0);
    expect(stateAt(urban, { ...urban.defaults, rainfallMm: 400 }, urban.durationH).exposedPeople).toBeGreaterThan(0);
  });
});

describe('response plan', () => {
  it('is fully deterministic', () => {
    for (const def of SCENARIOS) {
      const a = computePlan(def, def.defaults);
      const b = computePlan(def, def.defaults);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
  it('coordinated planning is never worse than the uncoordinated baseline on coverage', () => {
    for (const def of SCENARIOS) {
      const p = computePlan(def, def.defaults);
      const u = computePlan(def, { ...def.defaults, strategy: 'uncoordinated' });
      expect(p.metrics.coveragePct).toBeGreaterThanOrEqual(u.metrics.coveragePct);
    }
  });
  it('flood default: planner clearly beats the baseline and more boats + earlier start improve coverage', () => {
    const p = computePlan(flood, flood.defaults);
    const u = computePlan(flood, { ...flood.defaults, strategy: 'uncoordinated' });
    const b = computePlan(flood, { ...flood.defaults, boats: 30, responseDelayH: 2 });
    expect(p.metrics.coveragePct - u.metrics.coveragePct).toBeGreaterThan(5);
    expect(b.metrics.coveragePct).toBeGreaterThan(p.metrics.coveragePct);
    expect(b.readiness.score).toBeGreaterThan(p.readiness.score);
  });
  it('longer response delay never improves coverage', () => {
    const early = computePlan(flood, { ...flood.defaults, responseDelayH: 0 });
    const late = computePlan(flood, { ...flood.defaults, responseDelayH: 18 });
    expect(late.metrics.coveragePct).toBeLessThanOrEqual(early.metrics.coveragePct);
  });
  it('served never exceeds demand and metrics are internally consistent', () => {
    for (const def of SCENARIOS) {
      const m = computePlan(def, def.defaults).metrics;
      expect(m.served).toBeLessThanOrEqual(m.assistedDemand);
      expect(m.unmet).toBe(Math.max(0, m.assistedDemand - m.served));
      expect(m.sheltered).toBeLessThanOrEqual(m.shelterDemand);
      expect(m.medicalServed).toBeLessThanOrEqual(m.medicalDemand);
      expect(m.unitsDeployed).toBeLessThanOrEqual(m.unitsTotal);
    }
  });
  it('shelters are never over capacity and trips respect the time cap', () => {
    const p = computePlan(flood, flood.defaults);
    for (const s of p.shelters) expect(s.assigned).toBeLessThanOrEqual(s.capacity);
    for (const a of p.shelterAssignments.filter((x) => x.people > 0)) expect(a.trip.hours).toBeLessThanOrEqual(MAX_SHELTER_TRIP_H);
  });
  it('disabling the largest shelter reduces usable capacity', () => {
    const p = computePlan(flood, flood.defaults);
    const q = computePlan(flood, { ...flood.defaults, disabledShelters: ['sh-multan'] });
    expect(q.metrics.shelterCapacity).toBeLessThan(p.metrics.shelterCapacity);
  });
  it('each planner assignment explains itself with alternatives', () => {
    const p = computePlan(flood, flood.defaults);
    expect(p.assignments.length).toBeGreaterThan(0);
    for (const a of p.assignments) {
      expect(a.reason.length).toBeGreaterThan(20);
      expect(a.source).toBe('planner');
    }
  });
  it('dispatcher overrides reassign and stand down units, and recompute coverage', () => {
    const p = computePlan(flood, flood.defaults);
    const kindOf = (needId: string) => p.needs.find((x) => x.id === needId)!.kind;
    const pick = p.assignments.find((a) => p.needs.some((n) => n.id !== a.needId && n.kind === kindOf(a.needId)))!;
    const unit = pick.unitId;
    const other = p.needs.find((n) => n.id !== pick.needId && n.kind === kindOf(pick.needId))!;
    const moved = computePlan(flood, flood.defaults, { [unit]: other.id });
    expect(moved.assignments.find((a) => a.unitId === unit)!.needId).toBe(other.id);
    expect(moved.assignments.find((a) => a.unitId === unit)!.source).toBe('manual');
    const stood = computePlan(flood, flood.defaults, { [unit]: null });
    expect(stood.assignments.find((a) => a.unitId === unit)).toBeUndefined();
    expect(unitStatus(stood, unit, 10)).toBe('standby');
  });
  it('unit status follows the clock: assigned → en-route → on-scene', () => {
    const p = computePlan(flood, flood.defaults);
    const a = p.assignments.find((x) => x.travelH > 0.5)!;
    expect(unitStatus(p, a.unitId, 0)).toBe('assigned');
    expect(unitStatus(p, a.unitId, flood.defaults.responseDelayH + a.travelH / 2)).toBe('en-route');
    expect(unitStatus(p, a.unitId, flood.defaults.responseDelayH + a.travelH + 0.1)).toBe('on-scene');
  });
  it('landslide severity isolates more settlements; ambulances cannot reach isolated ones', () => {
    const lo = computePlan(slide, { ...slide.defaults, slideSeverity: 0.3 });
    const hi = computePlan(slide, { ...slide.defaults, slideSeverity: 0.95 });
    expect(hi.metrics.isolatedSettlements).toBeGreaterThan(lo.metrics.isolatedSettlements);
    expect(hi.bottlenecks.some((b) => b.id === 'air')).toBe(true);
  });
  it('series covers the whole window and served never exceeds demand', () => {
    const p = computePlan(flood, flood.defaults);
    expect(p.series[0].hour).toBe(0);
    expect(p.series.at(-1)!.hour).toBe(flood.durationH);
    for (const s of p.series) expect(s.served).toBeLessThanOrEqual(s.demand);
  });
});

describe('unit distribution', () => {
  it('largest-remainder distribution sums to the total', () => {
    expect(distribute(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(distribute(0, [1, 2])).toEqual([0, 0]);
    expect(distribute(7, [0, 0])).toEqual([0, 0]);
    const units = buildUnits(flood, { ...flood.defaults, boats: 13 });
    expect(units.filter((u) => u.type === 'boat')).toHaveLength(13);
    expect(new Set(units.map((u) => u.id)).size).toBe(units.length);
  });
});
