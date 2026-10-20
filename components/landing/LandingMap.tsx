'use client';

import { useMemo } from 'react';
import { assessAll } from '@/lib/risk/engine';
import { regionById } from '@/lib/data/regions';
import { DEFAULT_SCENARIO } from '@/lib/scenario/definitions';
import { stateAt } from '@/lib/scenario/engine';
import { PakMap, Marker, MapLegend } from '@/components/map/PakMap';
import { HazardLayer } from '@/components/scenario/ScenarioOverlay';
import { BAND_COLOR } from '@/components/ui/primitives';

export function LandingMap() {
  const risk = useMemo(() => assessAll('flood'), []);
  const state = useMemo(() => stateAt(DEFAULT_SCENARIO, DEFAULT_SCENARIO.defaults, DEFAULT_SCENARIO.durationH), []);
  return (
    <div className="relative h-full">
      <PakMap
        minHeight={380}
        controls={false}
        layers={{ provinces: true, rivers: true, roads: true, labels: true }}
        ariaLabel="Preview: flood risk screening across Pakistan with the simulated Southern Punjab scenario"
        overlay={<HazardLayer state={state} def={DEFAULT_SCENARIO} />}
        screenOverlay={
          <g>
            {risk.map((a) => {
              const r = regionById(a.regionId)!;
              return <Marker key={a.regionId} at={r.coord} r={4 + a.riskScore / 16} color={BAND_COLOR[a.riskBand]} pulse={a.riskBand === 'critical'} label={`${r.name}: flood ${a.riskBand}`} />;
            })}
          </g>
        }
      />
      <MapLegend className="absolute bottom-6 left-3 w-52" title="Flood screening" items={[{ label: 'Critical', color: BAND_COLOR.critical }, { label: 'High', color: BAND_COLOR.high }, { label: 'Moderate', color: BAND_COLOR.moderate }, { label: 'Simulated footprint', color: 'var(--map-water-hazard)', shape: 'band' }]} />
    </div>
  );
}
