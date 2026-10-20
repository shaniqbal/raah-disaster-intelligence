import type { LonLat } from '@/lib/geo/geometry';

/** Every number shown in RAAH carries one of these modes. */
export type DataMode = 'live' | 'historical' | 'estimated' | 'simulated' | 'assumption' | 'unavailable';

export type HazardType = 'flood' | 'earthquake' | 'heatwave' | 'landslide' | 'urban_flood';

export type RiskBand = 'low' | 'moderate' | 'high' | 'critical';

export interface SourceRef {
  id: string;
  name: string;
  provider: string;
  url: string;
  license: string;
  mode: DataMode;
  coverage: string;
  updateFrequency: string;
  limitations: string;
}

export interface RiskFactor {
  id: string;
  label: string;
  dimension: 'hazard' | 'exposure' | 'access';
  /** normalised 0–10 */
  score: number;
  /** human-readable raw value, e.g. "6.5 km to Chenab" */
  value: string;
  mode: DataMode;
  sourceIds: string[];
  explanation: string;
}

export interface RiskAssessment {
  id: string;
  hazard: HazardType;
  regionId: string;
  assessedAt: string;
  /** 0–100, see lib/risk/engine.ts for the formula */
  riskScore: number;
  riskBand: RiskBand;
  hazardScore: number;
  exposureScore: number;
  accessScore: number;
  factors: RiskFactor[];
  uncertainty: string;
  assumptions: string[];
  actions: string[];
  sourceIds: string[];
  mode: 'estimated';
  modelVersion: string;
}

export interface Region {
  id: string;
  name: string;
  nameUr: string;
  province: string;
  coord: LonLat;
  coordSource: 'natural-earth' | 'approximate';
  terrain: 'plain' | 'riverine' | 'foothill' | 'mountain' | 'coastal' | 'desert';
  /** analyst size class 1 (village/town) … 5 (megacity) — see methodology */
  sizeClass: 1 | 2 | 3 | 4 | 5;
  /** analyst climatological heat class 0–3 — assumption pending PMD normals */
  heatClass: 0 | 1 | 2 | 3;
  /** historical event ids from lib/data/historical.ts that affected this region */
  historicalEvents: string[];
}

export interface HistoricalEvent {
  id: string;
  hazard: HazardType;
  title: string;
  date: string;
  /** representative point; epicentre for earthquakes */
  coord: LonLat;
  coordNote: string;
  magnitude?: number;
  summary: string;
  impacts: string[];
  regions: string[];
  sources: { label: string; url: string }[];
}
