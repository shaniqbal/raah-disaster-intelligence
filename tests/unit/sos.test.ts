import { describe, expect, it } from 'vitest';
import { advance, createCase, purgeExpired, roundCoord, SosInput, SOS_RETENTION_MS } from '@/lib/citizen/sos';

const input = { category: 'flood' as const, locationLabel: 'Alipur', people: 4, assistance: ['evacuation' as const], precise: false, contact: '', notes: '' };

describe('SOS demo lifecycle', () => {
  it('creates a reported, device-only demo case', () => {
    const c = createCase(input, new Date('2026-01-01T00:00:00Z'), 'SOS-1');
    expect(c.state).toBe('reported');
    expect(c.demo).toBe(true);
    expect(c.history[0].note).toMatch(/Not sent/);
  });
  it('advances exactly one step at a time and stops at resolved', () => {
    let c = createCase(input);
    const seen = [c.state];
    for (let i = 0; i < 6; i++) {
      c = advance(c);
      seen.push(c.state);
    }
    expect(seen).toEqual(['reported', 'reviewed', 'assigned', 'in_progress', 'resolved', 'resolved', 'resolved']);
    expect(c.history).toHaveLength(5);
  });
  it('rounds location to ~1 km unless precise is chosen', () => {
    expect(roundCoord([71.19333, 30.07211], false)).toEqual([71.19, 30.07]);
    expect(roundCoord([71.19333, 30.07211], true)).toEqual([71.1933, 30.0721]);
    const c = createCase({ ...input, coord: [71.19333, 30.07211] });
    expect(c.coord).toEqual([71.19, 30.07]);
  });
  it('validates input', () => {
    expect(SosInput.safeParse({ ...input, locationLabel: '' }).success).toBe(false);
    expect(SosInput.safeParse({ ...input, people: 0 }).success).toBe(false);
    expect(SosInput.safeParse({ ...input, assistance: [] }).success).toBe(false);
    expect(SosInput.safeParse({ ...input, contact: 'call me<script>' }).success).toBe(false);
    expect(SosInput.safeParse({ ...input, coord: [10, 10] }).success).toBe(false);
  });
  it('purges reports older than the retention window', () => {
    const now = Date.now();
    const fresh = createCase(input, new Date(now - 1000));
    const old = createCase(input, new Date(now - SOS_RETENTION_MS - 1000));
    expect(purgeExpired([fresh, old], now)).toEqual([fresh]);
  });
});
