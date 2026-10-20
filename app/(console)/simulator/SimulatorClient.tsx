'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Link2, Pause, Play, RotateCcw, SkipBack, Presentation, Info } from 'lucide-react';
import { useScenario } from '@/hooks/useScenario';
import { SCENARIOS } from '@/lib/scenario/definitions';
import type { ScenarioPlan } from '@/lib/scenario/engine';
import { PakMap, MapLegend } from '@/components/map/PakMap';
import { HazardLayer, RouteLines, ScenarioMarkers, SCENARIO_LEGEND } from '@/components/scenario/ScenarioOverlay';
import { CoverageChart } from '@/components/scenario/CoverageChart';
import { Bottlenecks, ComparisonTable, KeyMetrics, PRESETS, ReadinessCard, RoleBriefs, Timeline, presetParams, useVariant, type PresetId } from '@/components/scenario/Panels';
import { Button, Card, DemoNotice, ModeBadge, SectionTitle, Slider, Tabs, Toggle, cx } from '@/components/ui/primitives';
import { useToast } from '@/components/shell/AppProviders';

type Tab = 'overview' | 'compare' | 'roles' | 'settlements' | 'assumptions';

export function SimulatorClient() {
  const { def, params, setParams, selectScenario, reset, plan, current, shareQuery, stale } = useScenario();
  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<PresetId>('baseline');
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const toast = useToast();
  const variant = useVariant(def, params, preset, tab === 'compare');

  // ---- clock playback ----
  const hourRef = useRef(params.hour);
  hourRef.current = params.hour;
  useEffect(() => {
    if (!playing) return;
    const step = def.durationH > 36 ? 2 : 1;
    const id = setInterval(() => {
      const next = hourRef.current + step;
      if (next > def.durationH) {
        setPlaying(false);
        return;
      }
      setParams({ hour: next });
    }, 450);
    return () => clearInterval(id);
  }, [playing, def.durationH, setParams]);

  const share = async () => {
    const url = `${window.location.origin}/simulator?${shareQuery}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Scenario link copied — it contains only scenario parameters.', 'ok');
    } catch {
      window.prompt('Copy this scenario link', url);
    }
  };

  const routes = useMemo(() => buildRoutes(plan, selected), [plan, selected]);
  const selectedSettlement = plan.settlements.find((s) => s.settlement.id === selected);

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Digital twin · what-if" title="Disaster Simulator">
        Adjust hazard and response assumptions and watch exposure, closures, shelter demand and resource coverage recalculate. Every output is computed from the documented scenario — <strong className="text-sim">simulation, not observed data</strong>.
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs label="Scenario" value={def.id} onChange={(id) => { setSelected(null); selectScenario(id); }} tabs={SCENARIOS.map((s) => ({ value: s.id, label: s.shortTitle }))} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={share}><Link2 className="size-3.5" aria-hidden /> Share scenario</Button>
          <Button size="sm" variant="ghost" onClick={() => { reset(); toast('Scenario reset to defaults'); }}><RotateCcw className="size-3.5" aria-hidden /> Reset</Button>
          <Link href={`/resources?${shareQuery}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 text-xs text-ink hover:bg-surface-3">Dispatch view</Link>
          <Link href="/demo" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink"><Presentation className="size-3.5" aria-hidden /> Guided demo</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        {/* ---------------- controls ---------------- */}
        <Card title="Assumptions & resources" mode="assumption" className="order-2 xl:order-1" bodyClassName="space-y-4">
          <p className="text-xs leading-snug text-muted">{def.summary}</p>
          {def.controls.map((c) => (
            <Slider key={c.key} label={c.label} value={params[c.key] as number} min={c.min} max={c.max} step={c.step} unit={c.unit} help={c.help} onChange={(v) => setParams({ [c.key]: v })} />
          ))}
          {def.closures.length > 0 && (
            <fieldset className="space-y-2.5">
              <legend className="mb-1 text-xs font-semibold text-ink">Assumed closures</legend>
              {def.closures.map((c) => (
                <Toggle key={c.id} label={c.label} checked={params.closures.includes(c.id)} onChange={(on) => setParams({ closures: on ? [...params.closures, c.id] : params.closures.filter((x) => x !== c.id) })} />
              ))}
            </fieldset>
          )}
          <fieldset className="space-y-2.5">
            <legend className="mb-1 text-xs font-semibold text-ink">Shelter availability</legend>
            {def.shelters.map((s) => (
              <Toggle key={s.id} label={s.name} description={`${s.capacity.toLocaleString('en')} nominal places (illustrative)`} checked={!params.disabledShelters.includes(s.id)} onChange={(on) => setParams({ disabledShelters: on ? params.disabledShelters.filter((x) => x !== s.id) : [...params.disabledShelters, s.id] })} />
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-semibold text-ink">Response strategy</legend>
            <Tabs label="Strategy" value={params.strategy} onChange={(v) => setParams({ strategy: v })} tabs={[{ value: 'coordinated', label: 'RAAH planner' }, { value: 'uncoordinated', label: 'Uncoordinated' }]} />
          </fieldset>
        </Card>

        {/* ---------------- map + clock ---------------- */}
        <div className="order-1 min-w-0 space-y-3 xl:order-2">
          <div className="relative h-[52vh] min-h-[360px] xl:h-[62vh]">
            <PakMap
              view={def.view}
              layers={{ provinces: true, rivers: true, roads: true, labels: true }}
              closedEdges={current.closedEdges}
              ariaLabel={`Map of ${def.region} showing the simulated hazard at hour ${params.hour}`}
              overlay={
                <>
                  <HazardLayer state={current} def={def} />
                  <RouteLines routes={routes} />
                </>
              }
              screenOverlay={<ScenarioMarkers def={def} plan={plan} state={current} selected={selected} onSelect={setSelected} />}
            />
            <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-2">
              <div className="pointer-events-auto rounded-lg border border-line bg-surface/90 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2">
                  <ModeBadge mode="simulated" />
                  <span className="tabular font-mono text-sm font-semibold text-ink">T+{params.hour}h</span>
                </div>
                <p className="mt-0.5 max-w-[240px] text-[11px] text-ink-2">{current.footprint.magnitudeLabel}</p>
                <p className="tabular font-mono text-[11px] text-muted">{current.exposedPeople.toLocaleString('en')} exposed · {current.closedRoadKm} km closed</p>
              </div>
            </div>
            <MapLegend items={SCENARIO_LEGEND} defaultOpen={false} className="absolute bottom-6 right-2 hidden w-60 md:block" />
          </div>
          <div className="panel flex flex-wrap items-center gap-3 px-3 py-2.5">
            <Button size="sm" variant="primary" onClick={() => { if (params.hour >= def.durationH) setParams({ hour: 0 }); setPlaying((p) => !p); }} aria-label={playing ? 'Pause scenario clock' : 'Play scenario clock'}>
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? 'Pause' : 'Play'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPlaying(false); setParams({ hour: 0 }); }} aria-label="Back to hour 0"><SkipBack className="size-3.5" /></Button>
            <div className="min-w-[200px] flex-1">
              <Slider label="Scenario clock" value={params.hour} min={0} max={def.durationH} step={1} unit=" h" onChange={(v) => { setPlaying(false); setParams({ hour: v }); }} />
            </div>
            <span className="text-[11px] text-muted">Peak at T+{def.peakH}h · window {def.durationH}h</span>
          </div>
          {selectedSettlement && (
            <Card title={selectedSettlement.settlement.name} subtitle={selectedSettlement.settlement.synthetic ? 'Synthetic representative cluster' : 'Approximate town centre'} mode="simulated" actions={<Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>}>
              <SettlementExplain plan={plan} id={selectedSettlement.settlement.id} />
            </Card>
          )}
        </div>

        {/* ---------------- outputs ---------------- */}
        <div className={cx('order-3 min-w-0 space-y-3 transition-opacity', stale && 'opacity-70')} aria-busy={stale}>
          <Card title="Scenario outputs at peak" mode="simulated" bodyClassName="space-y-3">
            <KeyMetrics plan={plan} />
            <ReadinessCard plan={plan} />
          </Card>
          <Card title="Bottlenecks" mode="estimated">
            <Bottlenecks plan={plan} />
          </Card>
        </div>
      </div>

      <Tabs
        label="Analysis"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Coverage & timeline' },
          { value: 'compare', label: 'A/B compare' },
          { value: 'roles', label: 'Role briefs' },
          { value: 'settlements', label: 'Settlements' },
          { value: 'assumptions', label: 'Assumptions' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card title="Assisted evacuation over time" mode="simulated" subtitle="Demand grows with exposure; served capacity starts after the response delay plus travel time.">
            <CoverageChart series={plan.series} hour={params.hour} />
          </Card>
          <Card title="Operational timeline" mode="simulated">
            <div className="scrollbar-thin max-h-72 overflow-y-auto pr-1">
              <Timeline plan={plan} hour={params.hour} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'compare' && (
        <Card title="Compare response strategies" mode="simulated" subtitle="Variant B re-runs the same scenario with one change. Everything else is held constant.">
          <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Variant B">
            {PRESETS.map((p) => (
              <button key={p} role="radio" aria-checked={preset === p} onClick={() => setPreset(p)} className={cx('rounded-full border px-3 py-1 text-xs', preset === p ? 'border-sim bg-sim/15 text-ink' : 'border-line text-ink-2 hover:bg-surface-2')}>
                {presetParams(def, params, p).label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {variant && <ComparisonTable a={plan} b={variant.plan} labelA={params.strategy === 'coordinated' ? 'Current plan' : 'Current (baseline)'} labelB={variant.label} />}
            {variant && <CoverageChart series={plan.series} compare={variant.plan.series} label="Served over time: current vs variant B" />}
          </div>
        </Card>
      )}

      {tab === 'roles' && <RoleBriefs def={def} plan={plan} />}

      {tab === 'settlements' && (
        <Card title="Settlement detail" mode="simulated" subtitle="Select a row (or a map marker) to explain its routing and resource decisions.">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  {['Settlement', 'Assumed pop.', 'Exposed', 'Road access', 'Needs', 'Served', 'First unit', 'Primary shelter', ''].map((h) => (
                    <th key={h} className="py-2 pr-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.settlements.map((s) => (
                  <tr key={s.settlement.id} className={cx('border-b border-line/60', selected === s.settlement.id && 'bg-accent/5')}>
                    <td className="py-1.5 pr-3 text-ink">{s.settlement.name}{s.settlement.synthetic && <span className="ml-1 text-[10px] text-sim">synthetic</span>}</td>
                    <td className="tabular py-1.5 pr-3 font-mono">{s.settlement.population.toLocaleString('en')}</td>
                    <td className="tabular py-1.5 pr-3 font-mono">{Math.round(s.exposureFraction * 100)}%</td>
                    <td className={cx('py-1.5 pr-3', s.roadAccess ? 'text-ok' : 'text-critical')}>{s.roadAccess ? 'Open' : 'Cut'}{s.deepWater ? ' · deep water' : ''}</td>
                    <td className="tabular py-1.5 pr-3 font-mono">{s.assistedDemand.toLocaleString('en')}</td>
                    <td className="tabular py-1.5 pr-3 font-mono">{s.served.toLocaleString('en')}</td>
                    <td className="tabular py-1.5 pr-3 font-mono">{s.firstArrivalH === null ? '—' : `${s.firstArrivalH} h`}</td>
                    <td className="py-1.5 pr-3 text-ink-2">{s.primaryShelter ? plan.shelters.find((x) => x.shelter.id === s.primaryShelter!.shelterId)?.shelter.name : '—'}</td>
                    <td className="py-1.5"><Button size="sm" variant="ghost" onClick={() => setSelected(s.settlement.id)}>Explain</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'assumptions' && (
        <Card title={`Assumptions — ${def.title}`} mode="assumption">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            {def.assumptions.map((a) => <li key={a}>{a}</li>)}
            <li>Unit rates: boat 6.7 people/h, rescue team 15 people/h (5/h on foot), ambulance one case per round trip + 45 min.</li>
            <li>The plan is computed against the forecast peak; the clock shows how demand and service unfold.</li>
          </ul>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" />Full equations: <Link href="/methodology#scenario" className="text-accent underline">Methodology → Scenario engine</Link>.</p>
        </Card>
      )}

      <DemoNotice compact />
    </div>
  );
}

function buildRoutes(plan: ScenarioPlan, selected: string | null) {
  const out: { id: string; coords: [number, number][]; color: string; dash?: string; width?: number }[] = [];
  for (const sa of plan.shelterAssignments) {
    if (!sa.trip.feasible || sa.people <= 0 || sa.trip.coords.length < 2) continue;
    if (selected && sa.settlementId !== selected) continue;
    out.push({ id: `sh-${sa.settlementId}-${sa.shelterId}`, coords: sa.trip.coords, color: sa.trip.method === 'boat' ? 'var(--info)' : 'var(--accent)', dash: sa.trip.method === 'graph' ? undefined : '4 3', width: selected ? 3 : 2 });
  }
  if (selected) {
    for (const d of plan.dispatchTrips) {
      if (d.settlementId !== selected || !d.trip.feasible) continue;
      out.push({ id: `dp-${d.unitId}`, coords: d.trip.coords, color: 'var(--sim)', dash: '2 3', width: 1.5 });
    }
  }
  return out;
}

function SettlementExplain({ plan, id }: { plan: ScenarioPlan; id: string }) {
  const s = plan.settlements.find((x) => x.settlement.id === id)!;
  const needs = plan.needs.filter((n) => n.settlementId === id);
  const assigns = plan.assignments.filter((a) => needs.some((n) => n.id === a.needId));
  const shelters = plan.shelterAssignments.filter((x) => x.settlementId === id && x.people > 0);
  return (
    <div className="grid gap-4 text-xs md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-ink-2">
          {Math.round(s.exposureFraction * 100)}% of an assumed {s.settlement.population.toLocaleString('en')} people are inside the footprint at peak ({s.exposedPeople.toLocaleString('en')}). Road access is <strong className={s.roadAccess ? 'text-ok' : 'text-critical'}>{s.roadAccess ? 'open' : 'cut'}</strong>
          {s.deepWater ? '; the depth proxy exceeds 1 m so evacuation needs boats.' : '.'}
        </p>
        {s.settlement.note && <p className="text-muted">{s.settlement.note}</p>}
        <p className="font-semibold text-ink">Shelter routing</p>
        {shelters.length ? (
          <ul className="space-y-1">
            {shelters.map((x) => (
              <li key={x.shelterId} className="text-ink-2">
                {x.people.toLocaleString('en')} → {plan.shelters.find((y) => y.shelter.id === x.shelterId)?.shelter.name}: {x.trip.km.toFixed(1)} km, {x.trip.hours.toFixed(1)} h. <span className="text-muted">{x.trip.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No one from this settlement needs public shelter, or no shelter is reachable.</p>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-ink">Why these units ({assigns.length})</p>
        {assigns.length ? (
          <ul className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto pr-1">
            {assigns.slice(0, 8).map((a) => (
              <li key={a.unitId} className="rounded-lg border border-line p-2">
                <p className="font-mono text-[11px] text-accent">{a.unitId} · {a.travelH.toFixed(1)} h away · +{Math.round(a.contribution).toLocaleString('en')}</p>
                <p className="text-ink-2">{a.reason}</p>
                {a.alternatives.length > 0 && <p className="mt-0.5 text-muted">Alternatives considered: {a.alternatives.map((x) => `${x.unitId} (${x.travelH.toFixed(1)} h, +${Math.round(x.contribution)})`).join('; ')}</p>}
              </li>
            ))}
            {assigns.length > 8 && <li className="text-muted">+{assigns.length - 8} more units</li>}
          </ul>
        ) : (
          <p className="text-muted">No units assigned — either no need here or no suitable unit can reach it in time.</p>
        )}
      </div>
    </div>
  );
}
