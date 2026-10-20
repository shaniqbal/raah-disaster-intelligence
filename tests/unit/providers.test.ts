import { afterEach, describe, expect, it, vi } from 'vitest';
import { normaliseUsgs, usgsUrl } from '@/lib/providers/usgs';
import { normaliseOpenMeteo } from '@/lib/providers/openMeteo';
import { fetchJson } from '@/lib/providers/types';
import { REGIONS } from '@/lib/data/regions';

afterEach(() => vi.unstubAllGlobals());

describe('USGS normalisation', () => {
  it('normalises valid features, drops malformed ones and sorts newest first', () => {
    const json = {
      features: [
        { id: 'a', properties: { mag: 4.6, place: 'Hindu Kush', time: 1_700_000_000_000, url: 'https://x/a' }, geometry: { coordinates: [70.5, 36.5, 200] } },
        { id: 'b', properties: { mag: 5.1, place: null, time: 1_700_100_000_000 }, geometry: { coordinates: [67, 30, 10] } },
        { id: 'bad', properties: { mag: null, place: 'x', time: 1 }, geometry: { coordinates: [1, 2, 3] } },
        { nonsense: true },
      ],
    };
    const out = normaliseUsgs(json);
    expect(out.map((q) => q.id)).toEqual(['b', 'a']);
    expect(out[0].place).toBe('Unknown location');
    expect(out[1].coord).toEqual([70.5, 36.5]);
  });
  it('throws on a non-collection payload', () => {
    expect(() => normaliseUsgs({ error: 'x' })).toThrow();
  });
  it('builds a bounded query URL', () => {
    const u = usgsUrl(30, 4, new Date('2026-10-20T00:00:00Z'));
    expect(u).toContain('starttime=2026-09-20');
    expect(u).toContain('minmagnitude=4');
    expect(u).toContain('minlatitude=23.5');
  });
});

describe('Open-Meteo normalisation', () => {
  it('maps array results to regions and excludes locations with missing values', () => {
    const ok = { daily: { time: ['d1', 'd2', 'd3'], precipitation_sum: [1, 2, 3], temperature_2m_max: [40, 42, 41] } };
    const missing = { daily: { time: ['d1', 'd2', 'd3'], precipitation_sum: [1, null, 3], temperature_2m_max: [40, 42, 41] } };
    const out = normaliseOpenMeteo([ok, missing]);
    expect(out).toHaveLength(1);
    expect(out[0].regionId).toBe(REGIONS[0].id);
    expect(out[0].rain3dMm).toBe(6);
    expect(out[0].tmax3dC).toBe(42);
  });
});

describe('fetchJson failure handling', () => {
  it('rejects on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })));
    await expect(fetchJson('https://example.test')).rejects.toThrow('HTTP 503');
  });
  it('times out instead of hanging', async () => {
    vi.stubGlobal('fetch', vi.fn((_: string, init: RequestInit) => new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))));
    await expect(fetchJson('https://example.test', 30)).rejects.toThrow('aborted');
  });
});
