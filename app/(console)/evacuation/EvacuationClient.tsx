'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Route as RouteIcon } from 'lucide-react';
import { SCENARIOS } from '@/lib/scenario/definitions';
import { computePlan, stateAt } from '@/lib/scenario/engine';
import { REGIONS } from '@/lib/data/regions';
import { getRoadGraph } from '@/lib/geo/data';
import { alternativeRoutes, LOCAL_TRIP_KM, type RouteResult } from '@/lib/geo/graph';
import { haversineKm, segmentCrossesLines, type LonLat } from '@/lib/geo/geometry';
import { PakMap, Marker, MapLegend } from '@/components/map/PakMap';
import { HazardLayer, RouteLines } from '@/components/scenario/ScenarioOverlay';
import { Card, ModeBadge, SectionTitle, Select, Slider, Toggle, cx } from '@/components/ui/primitives';

type ScenarioChoice = (typeof SCENARIOS)[number]['id'] | 'none';
type Transport = 'vehicle' | 'ambulance' | 'foot';
const ROUTE_COLORS = ['var(--accent)', 'var(--info)', 'var(--sim)'];
const FOOT_KMH = 4.5;

interface Place { id: string; name: string; coord: LonLat; kind: 'settlement' | 'shelter' | 'region' }

export function EvacuationClient() {
  const [scenarioId, setScenarioId] = useState<ScenarioChoice>('south-punjab-flood');
  const def = SCENARIOS.find((s) => s.id === scenarioId);
  const [hour, setHour] = useState(36);
  const [origin, setOrigin] = useState('k2');
  const [dest, setDest] = useState('auto');
  const [transport, setTransport] = useState<Transport>('vehicle');
  const [mobility, setMobility] = useState(false);
  const [selected, setSelected] = useState(0);

  const origins: Place[] = def ? def.settlements.map((s) => ({ id: s.id, name: s.name, coord: s.coord, kind: 'settlement' })) : REGIONS.map((r) => ({ id: r.id, name: r.name, coord: r.coord, kind: 'region' }));
  const dests: Place[] = def ? def.shelters.map((s) => ({ id: s.id, name: s.name, coord: s.coord, kind: 'shelter' })) : REGIONS.map((r) => ({ id: r.id, name: r.name, coord: r.coord, kind: 'region' }));
  const o = origins.find((x) => x.id === origin) ?? origins[0];

  const h = def ? Math.min(hour, def.durationH) : 0;
  const state = useMemo(() => (def ? stateAt(def, def.defaults, h) : null), [def, h]);
  const plan = useMemo(() => (def ? computePlan(def, def.defaults) : null), [def]);
  const closed = useMemo(() => new Set(state?.closedEdges ?? []), [state]);
  const g = getRoadGraph();

  const result = useMemo(() => {
    const candidates = dest === 'auto' ? dests.filter((d) => !state?.floodedShelters.includes(d.id) && d.id !== o.id) : dests.filter((d) => d.id === dest);
    let best: { d: Place; routes: RouteResult[] } | null = null;
    const considered: { d: Place; hours: number; feasible: boolean; reason?: string }[] = [];
    for (const d of candidates) {
      const routes = alternativeRoutes(g, o.coord, d.coord, closed, 3).map((r) => adjust(r, o.coord, d.coord, state, transport));
      const first = routes[0];
      const cap = plan?.shelters.find((s) => s.shelter.id === d.id);
      const full = cap && cap.usable && cap.assigned >= cap.capacity;
      considered.push({ d, hours: first.hours, feasible: first.feasible, reason: !first.feasible ? 'no open route' : full ? 'at capacity in plan' : undefined });
      if (first.feasible && !(dest === 'auto' && full) && (!best || first.hours < best.routes[0].hours)) best = { d, routes };
    }
    return { best, considered: considered.sort((a, b) => a.hours - b.hours) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id, dest, scenarioId, h, transport, closed]);

  const routes = result.best?.routes ?? [];
  const sel = routes[Math.min(selected, routes.length - 1)];
  const warnings: string[] = [];
  if (mobility && routes[0] && (routes[0].hours > 3 || routes[0].method === 'estimated-local')) warnings.push('Mobility-limited evacuees: prefer vehicle-assisted transfer; long or estimated local legs may need a rescue team escort.');
  if (state && state.exposure.find((e) => e.id === o.id)?.fraction && transport !== 'foot') warnings.push('Origin is inside the hazard footprint at this hour — the first leg may require a boat (not routed on roads).');

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Road-network routing" title="Smart Evacuation Planner">
        Routes are computed with Dijkstra’s algorithm over the Natural Earth major-road graph, with hazard closures applied at the chosen hour. Alternatives use the penalty method. <strong className="text-caution">These are planning illustrations, not verified emergency navigation.</strong>
      </SectionTitle>
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/5 px-4 py-3 text-xs text-ink-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
        <p><strong className="text-critical">Not for real-world navigation.</strong> Road data is generalised, closures are simulated and real road status is unknown to this demo. Always follow instructions from district administration, PDMA and Rescue 1122.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <Card title="Trip" bodyClassName="space-y-3">
          <Select label="Hazard context" value={scenarioId} onChange={(v) => { setScenarioId(v); const d = SCENARIOS.find((s) => s.id === v); setOrigin(d ? d.settlements[0].id : REGIONS[0].id); setDest(d ? 'auto' : REGIONS[1].id); setSelected(0); }} options={[...SCENARIOS.map((s) => ({ value: s.id as ScenarioChoice, label: `${s.shortTitle} (simulated)` })), { value: 'none' as const, label: 'No hazard — national network' }]} />
          <Select label="Start" value={o.id} onChange={(v) => { setOrigin(v); setSelected(0); }} options={origins.map((x) => ({ value: x.id, label: x.name }))} />
          <Select label="Destination" value={dest} onChange={(v) => { setDest(v); setSelected(0); }} options={[...(def ? [{ value: 'auto', label: 'Best reachable shelter (auto)' }] : []), ...dests.filter((d) => d.id !== o.id).map((x) => ({ value: x.id, label: x.name }))]} />
          <Select label="Transport" value={transport} onChange={setTransport} options={[{ value: 'vehicle', label: 'Vehicle (70/45 km/h by road class)' }, { value: 'ambulance', label: 'Ambulance (same speeds)' }, { value: 'foot', label: `On foot (${FOOT_KMH} km/h)` }]} />
          <Toggle label="Mobility-limited evacuees" description="Flags long or estimated legs that need assistance." checked={mobility} onChange={setMobility} />
          {def && <Slider label="Scenario hour" value={h} min={0} max={def.durationH} step={1} unit=" h" onChange={setHour} help="Closures and the hazard footprint at this hour." />}
        </Card>
        <div className="relative h-[60vh] min-h-[380px] min-w-0">
          <PakMap
            view={def ? def.view : { center: [69.6, 30.2], zoom: 5.2 }}
            layers={{ provinces: true, rivers: true, roads: true, labels: true }}
            closedEdges={state?.closedEdges}
            overlay={<>{state && def && <HazardLayer state={state} def={def} />}<RouteLines routes={routes.map((r, i) => ({ id: `r${i}`, coords: r.coords, color: ROUTE_COLORS[i], width: i === selected ? 4.5 : 2, dash: r.method === 'graph' ? undefined : '5 4' })).reverse()} /></>}
            screenOverlay={
              <g>
                {dests.map((d) => <Marker key={d.id} at={d.coord} r={d.kind === 'shelter' ? 6 : 4} shape={d.kind === 'shelter' ? 'triangle' : 'circle'} color={state?.floodedShelters.includes(d.id) ? 'var(--muted)' : d.id === result.best?.d.id ? 'var(--ok)' : 'var(--text-2)'} label={d.name} text={d.name} showLabel={d.id === result.best?.d.id} onSelect={() => { setDest(d.id); setSelected(0); }} />)}
                <Marker at={o.coord} r={8} color="var(--caution)" label={`Start: ${o.name}`} text={o.name} showLabel pulse />
              </g>
            }
          />
          <MapLegend className="absolute bottom-6 left-2 hidden w-52 sm:block" items={[{ label: 'Route 1 (fastest)', color: ROUTE_COLORS[0], shape: 'line' }, { label: 'Alternative 2', color: ROUTE_COLORS[1], shape: 'line' }, { label: 'Alternative 3', color: ROUTE_COLORS[2], shape: 'line' }, { label: 'Estimated local leg', color: 'var(--text-2)', shape: 'dash' }, { label: 'Closed road (simulated)', color: 'var(--critical)', shape: 'dash' }]} />
        </div>
        <div className="space-y-4">
          <Card title="Candidate routes" mode={def ? 'simulated' : 'estimated'}>
            {!routes.length || !routes[0].feasible ? (
              <p className="text-sm text-critical">No open road route under current closures. {def?.hazard.kind === 'riverine' ? 'A boat transfer to a road-accessible point would be required.' : 'Air or foot access would be required.'}</p>
            ) : (
              <ul className="space-y-2">
                {routes.map((r, i) => (
                  <li key={i}>
                    <button onClick={() => setSelected(i)} className={cx('w-full rounded-lg border p-2.5 text-left', i === selected ? 'border-accent bg-accent/5' : 'border-line hover:bg-surface-2')} aria-pressed={i === selected}>
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: ROUTE_COLORS[i] }} aria-hidden />
                        <span className="text-xs font-semibold text-ink">{i === 0 ? 'Fastest' : `Alternative ${i + 1}`}</span>
                        <span className="tabular ml-auto font-mono text-xs text-ink">{r.km.toFixed(0)} km · {fmtH(r.hours)}</span>
                      </div>
                      {i > 0 && <p className="mt-1 text-[11px] text-muted">+{fmtH(r.hours - routes[0].hours)} vs fastest — keeps redundancy if the first route closes.</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {result.best && (
              <p className="mt-2 flex items-center gap-1 text-xs text-ink-2">{o.name} <ArrowRight className="size-3" aria-hidden /> <strong className="text-ink">{result.best.d.name}</strong></p>
            )}
          </Card>
          {sel && sel.feasible && (
            <Card title="Why this route?">
              <ul className="space-y-1.5 text-xs text-ink-2">
                <li>{sel.note}</li>
                <li>{closed.size} road segments closed at T+{h}h are excluded from the graph.</li>
                {dest === 'auto' && <li>Destination chosen as the fastest reachable shelter that still has capacity in the scenario plan.</li>}
                <li className="text-muted">Speeds: 70 km/h major highways, 45 km/h other roads, 30 km/h access legs{transport === 'foot' ? `; on foot ${FOOT_KMH} km/h throughout` : ''}.</li>
              </ul>
              {warnings.map((w) => <p key={w} className="mt-2 rounded-md bg-caution/10 px-2 py-1.5 text-[11px] text-caution">{w}</p>)}
            </Card>
          )}
          {dest === 'auto' && result.considered.length > 0 && (
            <Card title="Shelters considered" mode="simulated">
              <ul className="space-y-1 text-xs">
                {result.considered.map((c) => (
                  <li key={c.d.id} className="flex justify-between gap-2">
                    <span className={cx(c.d.id === result.best?.d.id ? 'text-ok' : 'text-ink-2')}>{c.d.name}</span>
                    <span className="tabular font-mono text-muted">{c.feasible ? fmtH(c.hours) : '—'}{c.reason ? ` · ${c.reason}` : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-muted"><RouteIcon className="size-3.5" aria-hidden /> Road data <ModeBadge mode="historical" /> · closures <ModeBadge mode="simulated" /></p>
        </div>
      </div>
    </div>
  );
}

function fmtH(h: number) {
  if (!Number.isFinite(h)) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh ? `${hh} h ${mm} min` : `${mm} min`;
}

/** Applies transport speed and the local-trip corridor-crossing rule used by the scenario engine. */
function adjust(r: RouteResult, from: LonLat, to: LonLat, state: ReturnType<typeof stateAt> | null, transport: Transport): RouteResult {
  if (!r.feasible) return r;
  let out = { ...r };
  if (r.method === 'estimated-local' && haversineKm(from, to) < LOCAL_TRIP_KM && state?.footprint.kind === 'corridor' && state.footprint.halfWidthKm >= 0.3 && segmentCrossesLines(from, to, state.footprint.lines)) {
    out = { ...out, km: out.km * 2.2, hours: out.hours * 2.2, note: `${out.note} Crosses the flooded corridor → 2.2× detour.` };
  }
  if (transport === 'foot') out = { ...out, hours: out.km / FOOT_KMH };
  return out;
}
