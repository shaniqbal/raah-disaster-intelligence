import type { LonLat } from '@/lib/geo/geometry';

export type ResourceType = 'boat' | 'team' | 'ambulance';

export interface Settlement {
  id: string;
  name: string;
  coord: LonLat;
  /** assumed population (scenario assumption, not census) */
  population: number;
  synthetic: boolean;
  note?: string;
}

export interface Shelter {
  id: string;
  name: string;
  coord: LonLat;
  capacity: number;
}

export interface Depot {
  id: string;
  name: string;
  coord: LonLat;
  /** base counts — scaled to the totals in ScenarioParams */
  base: Record<ResourceType, number>;
}

export interface ClosureToggle {
  id: string;
  label: string;
  coord: LonLat;
  radiusKm: number;
}

export type HazardModel =
  | {
      kind: 'riverine';
      rivers: string[];
      /** corridor half-width km = baseKm + kmPerMetre × rise */
      baseKm: number;
      kmPerMetre: number;
    }
  | {
      kind: 'pluvial';
      channel: LonLat[];
      channelNote: string;
      /** rainfall the drainage can absorb before overflow (mm) */
      drainageCapacityMm: number;
      baseKm: number;
      kmPerMm: number;
    }
  | {
      kind: 'landslide';
      slides: { id: string; label: string; coord: LonLat; minSeverity: number; activatesAtH: number }[];
      baseRadiusKm: number;
      kmPerSeverity: number;
    };

export interface ControlSpec {
  key: keyof ScenarioParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
}

export interface ScenarioDefinition {
  id: 'south-punjab-flood' | 'twin-cities-urban-flood' | 'kohistan-landslide';
  title: string;
  shortTitle: string;
  region: string;
  summary: string;
  hazardLabel: string;
  durationH: number;
  peakH: number;
  view: { center: LonLat; zoom: number };
  bbox: [number, number, number, number];
  hazard: HazardModel;
  settlements: Settlement[];
  shelters: Shelter[];
  depots: Depot[];
  closures: ClosureToggle[];
  controls: ControlSpec[];
  defaults: ScenarioParams;
  assumptions: string[];
  /** share of exposed people needing assisted evacuation */
  assistShare: number;
  /** share of exposed people seeking public shelter */
  shelterShare: number;
  /** share of exposed people becoming medical cases needing transport */
  medicalShare: number;
  /** share of population in road-isolated settlements needing outside assistance */
  isolationNeedShare: number;
}

export interface ScenarioParams {
  /** riverine: river level rise above bankfull (m) */
  riverRiseM: number;
  /** pluvial: rainfall total over the event (mm) */
  rainfallMm: number;
  /** landslide: severity 0–1 */
  slideSeverity: number;
  boats: number;
  teams: number;
  ambulances: number;
  /** % of nominal shelter capacity available */
  shelterCapacityPct: number;
  /** % multiplier on population demand */
  demandPct: number;
  /** hours before any unit starts moving */
  responseDelayH: number;
  /** level at which bridges / embanked approaches close (m) — riverine only */
  bridgeCloseM: number;
  closures: string[];
  disabledShelters: string[];
  /** scenario clock (h) */
  hour: number;
  /** 'coordinated' uses the RAAH planner; 'uncoordinated' is the naive baseline */
  strategy: 'coordinated' | 'uncoordinated';
}
