'use client';

import type { HourState, ScenarioPlan } from '@/lib/scenario/engine';
import type { ScenarioDefinition } from '@/lib/scenario/types';
import type { LonLat } from '@/lib/geo/geometry';
import { GeoCircle, GeoLine, MapLabels, Marker, useMap } from '@/components/map/PakMap';

export const EXPOSURE_COLOR = (f: number) => (f >= 0.6 ? 'var(--critical)' : f >= 0.25 ? 'var(--band-high)' : f > 0 ? 'var(--caution)' : 'var(--accent)');

/** Hazard footprint for a given hour, drawn in map space. */
export function HazardLayer({ state, def }: { state: HourState; def: ScenarioDefinition }) {
  const fp = state.footprint;
  if (fp.kind === 'corridor') {
    return (
      <g aria-label="Illustrative hazard footprint">
        {fp.halfWidthKm > 0 && <GeoLine lines={fp.lines} color="var(--map-water-hazard)" widthKm={fp.halfWidthKm} />}
        {fp.halfWidthKm > 0 && <GeoLine lines={fp.lines} color="var(--map-river)" widthKm={fp.halfWidthKm * 0.35} opacity={0.35} />}
        {def.hazard.kind === 'pluvial' && <GeoLine coords={def.hazard.channel} color="var(--map-river)" widthPx={2} dash="5 3" />}
      </g>
    );
  }
  return (
    <g aria-label="Landslide blockages">
      {fp.slides.map((s) =>
        s.active ? <GeoCircle key={s.id} at={s.coord} radiusKm={fp.radiusKm} fill="url(#raah-hatch)" stroke="var(--critical)" /> : <GeoCircle key={s.id} at={s.coord} radiusKm={0.6} fill="none" stroke="var(--muted)" opacity={0.6} />,
      )}
    </g>
  );
}

export function RouteLines({ routes }: { routes: { coords: LonLat[]; color: string; dash?: string; width?: number; id: string }[] }) {
  return (
    <g>
      {routes.map((r) => (
        <GeoLine key={r.id} coords={r.coords} color={r.color} widthPx={r.width ?? 2.5} dash={r.dash} />
      ))}
    </g>
  );
}

/** Screen-space markers: settlements sized by population and coloured by exposure; shelters; depots. */
export function ScenarioMarkers({
  def,
  plan,
  state,
  selected,
  onSelect,
  showLabels = true,
  showDepots = true,
}: {
  def: ScenarioDefinition;
  plan?: ScenarioPlan;
  state: HourState;
  selected?: string | null;
  onSelect?: (id: string) => void;
  showLabels?: boolean;
  showDepots?: boolean;
}) {
  const map = useMap();
  const labels = showLabels && map.k > 3;
  return (
    <g>
      {showDepots &&
        def.depots.map((d) => (
          <Marker key={d.id} at={d.coord} r={5} shape="square" color="var(--info)" label={`${d.name} (simulated depot)`} onSelect={onSelect ? () => onSelect(d.id) : undefined} selected={selected === d.id} />
        ))}
      {def.shelters.map((s) => {
        const info = plan?.shelters.find((x) => x.shelter.id === s.id);
        const flooded = state.floodedShelters.includes(s.id) || info?.usable === false;
        const full = info && info.usable && info.assigned >= info.capacity;
        return (
          <Marker
            key={s.id}
            at={s.coord}
            r={6}
            shape="triangle"
            color={flooded ? 'var(--muted)' : full ? 'var(--caution)' : 'var(--ok)'}
            label={`${s.name} — ${flooded ? 'unusable' : info ? `${info.assigned.toLocaleString('en')}/${info.capacity.toLocaleString('en')} placed` : `${s.capacity.toLocaleString('en')} capacity`} (illustrative shelter)`}
            onSelect={onSelect ? () => onSelect(s.id) : undefined}
            selected={selected === s.id}
            text={s.name}
            showLabel={selected === s.id}
          />
        );
      })}
      {def.settlements.map((s) => {
        const ex = state.exposure.find((e) => e.id === s.id);
        const f = ex?.fraction ?? 0;
        const sp = plan?.settlements.find((x) => x.settlement.id === s.id);
        const r = 4 + Math.sqrt(s.population / 12000);
        return (
          <Marker
            key={s.id}
            at={s.coord}
            r={r}
            color={EXPOSURE_COLOR(f)}
            pulse={f >= 0.6}
            label={`${s.name}: ${Math.round(f * 100)}% exposed${sp && !sp.roadAccess ? ', no road access' : ''}${s.synthetic ? ' (synthetic cluster)' : ''}`}
            onSelect={onSelect ? () => onSelect(s.id) : undefined}
            selected={selected === s.id}
          />
        );
      })}
      {showLabels && (
        <MapLabels
          items={def.settlements
            .filter((s) => selected === s.id || labels)
            .map((s) => {
              const f = state.exposure.find((e) => e.id === s.id)?.fraction ?? 0;
              return { id: s.id, at: s.coord, text: s.name.replace(/ cluster —/, ' —').replace(/ \(approx\.\)/, ''), r: 4 + Math.sqrt(s.population / 12000), priority: (selected === s.id ? 1e9 : 0) + (s.synthetic ? 0 : 1e6) + f * 1e5 + s.population / 10, tone: s.synthetic ? ('muted' as const) : ('default' as const) };
            })}
        />
      )}
    </g>
  );
}

export const SCENARIO_LEGEND = [
  { label: 'Illustrative hazard footprint', color: 'var(--map-water-hazard)', shape: 'band' as const },
  { label: 'Closed road segment', color: 'var(--critical)', shape: 'dash' as const },
  { label: 'Settlement (colour = exposure)', color: 'var(--band-high)' },
  { label: 'Shelter (green open · amber full · grey unusable)', color: 'var(--ok)', shape: 'square' as const },
  { label: 'Depot (simulated)', color: 'var(--info)', shape: 'square' as const },
  { label: 'Planned route', color: 'var(--accent)', shape: 'line' as const },
];
