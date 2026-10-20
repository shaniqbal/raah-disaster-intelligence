import { describe, expect, it } from 'vitest';
import { assessAll, assessRegion, bandFor, combine } from '@/lib/risk/engine';
import { REGIONS, regionById } from '@/lib/data/regions';
import { SOURCES } from '@/lib/data/sources';
import { HISTORICAL_EVENTS } from '@/lib/data/historical';
import type { HazardType } from '@/lib/domain/types';

const HAZARDS: HazardType[] = ['flood', 'urban_flood', 'earthquake', 'heatwave', 'landslide'];

describe('risk bands and formula', () => {
  it('band thresholds', () => {
    expect(bandFor(0)).toBe('low');
    expect(bandFor(29.9)).toBe('low');
    expect(bandFor(30)).toBe('moderate');
    expect(bandFor(50)).toBe('high');
    expect(bandFor(70)).toBe('critical');
    expect(bandFor(100)).toBe('critical');
  });
  it('zero hazard gives zero risk; max inputs give 100', () => {
    expect(combine(0, 10, 10)).toBe(0);
    expect(combine(10, 10, 10)).toBe(100);
  });
  it('risk is monotonic in hazard', () => {
    expect(combine(6, 5, 5)).toBeGreaterThan(combine(5, 5, 5));
  });
});

describe('regional assessments', () => {
  it('assesses all regions for every hazard, sorted descending, within 0–100', () => {
    for (const h of HAZARDS) {
      const list = assessAll(h, {}, new Date('2026-01-01'));
      expect(list).toHaveLength(REGIONS.length);
      for (let i = 1; i < list.length; i++) expect(list[i - 1].riskScore).toBeGreaterThanOrEqual(list[i].riskScore);
      for (const a of list) {
        expect(a.riskScore).toBeGreaterThanOrEqual(0);
        expect(a.riskScore).toBeLessThanOrEqual(100);
        expect(a.riskBand).toBe(bandFor(a.riskScore));
      }
    }
  });
  it('every factor references registered sources', () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const h of HAZARDS) for (const a of assessAll(h)) for (const f of a.factors) for (const s of f.sourceIds) expect(ids.has(s)).toBe(true);
  });
  it('unavailable live data is excluded, never simulated', () => {
    const a = assessRegion(regionById('muzaffargarh')!, 'flood');
    const rain = a.factors.find((f) => f.id === 'live-rain')!;
    expect(rain.mode).toBe('unavailable');
    expect(rain.score).toBe(0);
  });
  it('live rainfall raises flood risk when present', () => {
    const r = regionById('muzaffargarh')!;
    const dry = assessRegion(r, 'flood', { rain3dMm: 0, retrievedAt: 'x' });
    const wet = assessRegion(r, 'flood', { rain3dMm: 150, retrievedAt: 'x' });
    expect(wet.riskScore).toBeGreaterThan(dry.riskScore);
    expect(wet.factors.find((f) => f.id === 'live-rain')!.mode).toBe('live');
  });
  it('Quetta ranks among the highest earthquake screening scores (1935 epicentre nearby)', () => {
    const top3 = assessAll('earthquake').slice(0, 3).map((a) => a.regionId);
    expect(top3).toContain('quetta');
  });
  it('regions only reference known historical events', () => {
    const ids = new Set(HISTORICAL_EVENTS.map((e) => e.id));
    for (const r of REGIONS) for (const e of r.historicalEvents) expect(ids.has(e)).toBe(true);
  });
});
