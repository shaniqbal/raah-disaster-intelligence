import { describe, expect, it } from 'vitest';
import { haversineKm, pointToSegmentKm, segmentsIntersect, pointToLinesKm, clamp } from '@/lib/geo/geometry';

describe('geometry', () => {
  it('haversine: Islamabad–Lahore is ~265–275 km', () => {
    const d = haversineKm([73.081, 33.689], [74.348, 31.562]);
    expect(d).toBeGreaterThan(260);
    expect(d).toBeLessThan(280);
  });
  it('haversine is symmetric and zero for identical points', () => {
    expect(haversineKm([70, 30], [70, 30])).toBe(0);
    expect(haversineKm([70, 30], [71, 31])).toBeCloseTo(haversineKm([71, 31], [70, 30]), 9);
  });
  it('point-to-segment distance handles interior and endpoint projections', () => {
    // 0.1° of latitude ≈ 11.06 km
    expect(pointToSegmentKm([70, 30.1], [69.9, 30], [70.1, 30])).toBeCloseTo(11.06, 1);
    expect(pointToSegmentKm([70.2, 30], [69.9, 30], [70.1, 30])).toBeCloseTo(haversineKm([70.2, 30], [70.1, 30]), 0);
    expect(pointToLinesKm([70, 30.1], [[[69.9, 30], [70.1, 30]], [[70, 31], [71, 31]]])).toBeCloseTo(11.06, 1);
  });
  it('segment intersection', () => {
    expect(segmentsIntersect([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true);
    expect(segmentsIntersect([0, 0], [1, 0], [0, 1], [1, 1])).toBe(false);
  });
  it('clamp', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
