import { z } from 'zod';
import { REGIONS } from '@/lib/data/regions';
import { fetchJson, type DataProvider } from './types';

export interface RegionForecast {
  regionId: string;
  rain3dMm: number;
  tmax3dC: number;
  daily: { date: string; rainMm: number; tmaxC: number }[];
}

const LocationSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    precipitation_sum: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
  }),
});

export function openMeteoUrl(): string {
  const q = new URLSearchParams({
    latitude: REGIONS.map((r) => r.coord[1]).join(','),
    longitude: REGIONS.map((r) => r.coord[0]).join(','),
    daily: 'precipitation_sum,temperature_2m_max',
    forecast_days: '3',
    timezone: 'Asia/Karachi',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** Open-Meteo returns an array for multi-location queries (object for one). Missing values make a region unavailable. */
export function normaliseOpenMeteo(json: unknown): RegionForecast[] {
  const list = Array.isArray(json) ? json : [json];
  const out: RegionForecast[] = [];
  list.forEach((loc, i) => {
    const region = REGIONS[i];
    const r = LocationSchema.safeParse(loc);
    if (!region || !r.success) return;
    const { time, precipitation_sum: p, temperature_2m_max: t } = r.data.daily;
    if (p.some((v) => v === null) || t.some((v) => v === null)) return;
    out.push({
      regionId: region.id,
      rain3dMm: (p as number[]).reduce((a, b) => a + b, 0),
      tmax3dC: Math.max(...(t as number[])),
      daily: time.map((d, j) => ({ date: d, rainMm: p[j] as number, tmaxC: t[j] as number })),
    });
  });
  return out;
}

export const openMeteoProvider: DataProvider<RegionForecast[]> = {
  id: 'open-meteo',
  sourceId: 'open-meteo',
  fetch: async (signal) => normaliseOpenMeteo(await fetchJson(openMeteoUrl(), 9000, signal)),
};
