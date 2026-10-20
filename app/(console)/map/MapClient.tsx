'use client';

import { useMemo, useState } from 'react';
import { HISTORICAL_EVENTS } from '@/lib/data/historical';
import { REGIONS, regionById } from '@/lib/data/regions';
import { SCENARIOS } from '@/lib/scenario/definitions';
import { stateAt } from '@/lib/scenario/engine';
import { assessAll } from '@/lib/risk/engine';
import { ROAD_GRAPH_META } from '@/lib/geo/data';
import { PakMap, Marker, MapLegend, type MapView } from '@/components/map/PakMap';
import { HazardLayer, ScenarioMarkers } from '@/components/scenario/ScenarioOverlay';
import { BAND_COLOR, Card, ModeBadge, SectionTitle, Toggle } from '@/components/ui/primitives';
import { useLiveData, usePrefs } from '@/components/shell/AppProviders';

type LayerId = 'provinces' | 'rivers' | 'roads' | 'risk' | 'history' | 'quakes' | 'scenario';

export function MapClient() {
  const { quakes, liveInputs } = useLiveData();
  const { region, setRegion } = usePrefs();
  const [on, setOn] = useState<Record<LayerId, boolean>>({ provinces: true, rivers: true, roads: true, risk: true, history: false, quakes: true, scenario: false });
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [info, setInfo] = useState<{ title: string; lines: string[]; mode: 'historical' | 'estimated' | 'live' | 'simulated' } | null>(null);
  const def = SCENARIOS.find((s) => s.id === scenarioId)!;
  const scenarioState = useMemo(() => stateAt(def, def.defaults, def.durationH), [def]);
  const risk = useMemo(() => assessAll('flood', liveInputs), [liveInputs]);
  const [view, setView] = useState<MapView>({ center: [69.6, 30.2], zoom: 5.2 });

  const layers: { id: LayerId; label: string; mode: 'historical' | 'estimated' | 'live' | 'simulated' | 'cached' | 'unavailable'; note: string }[] = [
    { id: 'provinces', label: 'Provinces & territories', mode: 'historical', note: 'Natural Earth admin-1, renamed to current names' },
    { id: 'rivers', label: 'Main rivers', mode: 'historical', note: 'Indus, Chenab, Jhelum, Ravi, Sutlej, Beas' },
    { id: 'roads', label: 'Road graph', mode: 'historical', note: `${(ROAD_GRAPH_META as { keptNodes?: number }).keptNodes ?? ''} nodes · routing network` },
    { id: 'risk', label: 'Flood risk (screening)', mode: 'estimated', note: 'Relative index — see Risk Intelligence' },
    { id: 'history', label: 'Historical events', mode: 'historical', note: 'Curated, sourced list' },
    { id: 'quakes', label: 'Earthquakes · 30 days', mode: quakes.mode === 'loading' ? 'unavailable' : quakes.mode, note: 'USGS FDSN' },
    { id: 'scenario', label: 'Scenario footprint at peak', mode: 'simulated', note: 'Illustrative, not hydraulically modelled' },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Geospatial" title="Maps & Layers">
        Every layer is bundled for offline use except live feeds. Toggle layers, zoom to a region and select features for details and provenance.
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Layers">
            <ul className="space-y-3">
              {layers.map((l) => (
                <li key={l.id} className="flex items-start gap-2">
                  <div className="flex-1"><Toggle label={l.label} description={l.note} checked={on[l.id]} onChange={(v) => setOn((s) => ({ ...s, [l.id]: v }))} /></div>
                  <ModeBadge mode={l.mode} />
                </li>
              ))}
            </ul>
            {on.scenario && (
              <div className="mt-3">
                <label htmlFor="scn" className="text-xs text-ink-2">Scenario</label>
                <select id="scn" value={scenarioId} onChange={(e) => { setScenarioId(e.target.value as typeof scenarioId); const d = SCENARIOS.find((s) => s.id === e.target.value)!; setView(d.view); }} className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface-2 px-2 text-xs text-ink">
                  {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.shortTitle}</option>)}
                </select>
              </div>
            )}
          </Card>
          <Card title="Zoom to region">
            <select aria-label="Zoom to region" value={region} onChange={(e) => { setRegion(e.target.value); const r = regionById(e.target.value); setView(r ? { center: r.coord, zoom: 7.2 } : { center: [69.6, 30.2], zoom: 5.2 }); }} className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 px-2 text-xs text-ink">
              <option value="">All Pakistan</option>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Card>
          {info && (
            <Card title={info.title} mode={info.mode} actions={<button onClick={() => setInfo(null)} className="text-xs text-muted hover:text-ink">Close</button>}>
              <ul className="space-y-1 text-xs text-ink-2">{info.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            </Card>
          )}
        </div>
        <div className="relative h-[72vh] min-h-[420px]">
          <PakMap
            view={view}
            layers={{ provinces: on.provinces, rivers: on.rivers, roads: on.roads, labels: true }}
            closedEdges={on.scenario ? scenarioState.closedEdges : undefined}
            overlay={on.scenario ? <HazardLayer state={scenarioState} def={def} /> : undefined}
            screenOverlay={
              <g>
                {on.scenario && <ScenarioMarkers def={def} state={scenarioState} onSelect={(id) => { const s = def.settlements.find((x) => x.id === id) ?? def.shelters.find((x) => x.id === id) ?? def.depots.find((x) => x.id === id); if (s) setInfo({ title: s.name, mode: 'simulated', lines: ['Scenario feature (illustrative)', `Coordinates ${s.coord.map((v) => v.toFixed(3)).join(', ')}`] }); }} />}
                {on.history && HISTORICAL_EVENTS.map((e) => <Marker key={e.id} at={e.coord} r={6} shape="diamond" color="var(--info)" label={e.title} onSelect={() => setInfo({ title: e.title, mode: 'historical', lines: [e.date, e.summary, ...e.impacts, `Location: ${e.coordNote}`] })} />)}
                {on.quakes && quakes.data?.map((q) => <Marker key={q.id} at={q.coord} r={2 + q.magnitude} color="var(--sim)" label={`M${q.magnitude.toFixed(1)} ${q.place}`} onSelect={() => setInfo({ title: `M${q.magnitude.toFixed(1)} earthquake`, mode: 'live', lines: [q.place, new Date(q.time).toLocaleString(), `Depth ${q.depthKm.toFixed(0)} km`, `Source: USGS (${quakes.mode})`] })} />)}
                {on.risk && risk.map((a) => { const r = regionById(a.regionId)!; return <Marker key={a.regionId} at={r.coord} r={5 + a.riskScore / 14} color={BAND_COLOR[a.riskBand]} label={`${r.name}: flood ${a.riskBand} (${a.riskScore})`} text={r.name} showLabel={!on.scenario} selected={region === r.id} onSelect={() => { setRegion(r.id); setInfo({ title: r.name, mode: 'estimated', lines: [`${r.province}`, `Flood screening score ${a.riskScore} (${a.riskBand})`, ...a.factors.map((f) => `${f.label}: ${f.value}`)] }); }} />; })}
              </g>
            }
          />
          <MapLegend className="absolute bottom-6 right-2 hidden w-56 sm:block" items={[
            { label: 'Main river', color: 'var(--map-river)', shape: 'line' },
            { label: 'Road (graph edge)', color: 'var(--map-road-major)', shape: 'line' },
            { label: 'Flood risk band', color: BAND_COLOR.high },
            { label: 'Earthquake (USGS)', color: 'var(--sim)' },
            { label: 'Historical event', color: 'var(--info)', shape: 'square' },
            { label: 'Hazard footprint (illustrative)', color: 'var(--map-water-hazard)', shape: 'band' },
            { label: 'Closed road (scenario)', color: 'var(--critical)', shape: 'dash' },
          ]} />
        </div>
      </div>
    </div>
  );
}
