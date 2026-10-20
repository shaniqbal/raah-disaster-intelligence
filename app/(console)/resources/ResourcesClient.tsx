'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ambulance, Anchor, RotateCcw, Ship, Users } from 'lucide-react';
import { useScenario } from '@/hooks/useScenario';
import { SCENARIOS } from '@/lib/scenario/definitions';
import { computePlan, unitStatus, type ScenarioPlan } from '@/lib/scenario/engine';
import { PakMap } from '@/components/map/PakMap';
import { HazardLayer, RouteLines, ScenarioMarkers } from '@/components/scenario/ScenarioOverlay';
import { Button, Card, Meter, ModeBadge, SectionTitle, Slider, Tabs, cx } from '@/components/ui/primitives';
import { readStore, removeStore, useToast, writeStore } from '@/components/shell/AppProviders';

interface LogEntry { at: string; hour: number; actor: 'planner' | 'dispatcher'; text: string }
const TYPE_ICON = { boat: Ship, team: Users, ambulance: Ambulance } as const;
const STATUS_STYLE: Record<string, string> = { standby: 'text-muted', assigned: 'text-info', 'en-route': 'text-caution', 'on-scene': 'text-ok' };

export function ResourcesClient() {
  const toast = useToast();
  const [manual, setManual] = useState<Record<string, string | null>>({});
  const { def, params, setParams, selectScenario, plan, current, shareQuery } = useScenario(Object.keys(manual).length ? manual : undefined);
  const storeKey = `raah:dispatch:${shareQuery.replace(/(^|&)t=\d+/, '')}`;
  const [log, setLog] = useState<LogEntry[]>([]);
  const [focusNeed, setFocusNeed] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'boat' | 'team' | 'ambulance'>('all');

  // Load persisted dispatcher state for this scenario configuration.
  useEffect(() => {
    const saved = readStore<{ manual: Record<string, string | null>; log: LogEntry[] } | null>(storeKey, null);
    setManual(saved?.manual ?? {});
    setLog(saved?.log ?? []);
  }, [storeKey]);

  const persist = (m: Record<string, string | null>, l: LogEntry[]) => {
    setManual(m);
    setLog(l);
    writeStore(storeKey, { manual: m, log: l });
  };

  const auto = useMemo(() => computePlan(def, { ...params, hour: 0 }), [def, params]);
  const baseline = useMemo(() => computePlan(def, { ...params, hour: 0, strategy: 'uncoordinated' }), [def, params]);

  const plannerLog: LogEntry[] = useMemo(() => plan.timeline.filter((e) => e.kind === 'dispatch' || e.kind === 'arrival').map((e) => ({ at: '', hour: e.hour, actor: 'planner' as const, text: e.text })), [plan]);

  const assign = (unitId: string, needId: string | null) => {
    const need = plan.needs.find((n) => n.id === needId);
    const s = need && def.settlements.find((x) => x.id === need.settlementId);
    const text = needId ? `${unitId} reassigned to ${s?.name} (${need?.label.toLowerCase()}).` : `${unitId} stood down to standby.`;
    persist({ ...manual, [unitId]: needId }, [{ at: new Date().toISOString(), hour: params.hour, actor: 'dispatcher', text }, ...log]);
    toast(text, 'ok');
  };
  const resetDispatch = () => {
    removeStore(storeKey);
    setManual({});
    setLog([]);
    toast('Dispatch reset to the RAAH planner.');
  };

  const needsBySettlement = def.settlements
    .map((s) => ({ s, needs: plan.needs.filter((n) => n.settlementId === s.id) }))
    .filter((x) => x.needs.length);
  const units = plan.units.filter((u) => typeFilter === 'all' || u.type === typeFilter);
  const served = (p: ScenarioPlan, needId: string) => p.assignments.filter((a) => a.needId === needId).reduce((x, a) => x + a.contribution, 0);
  const routes = plan.dispatchTrips
    .filter((d) => d.trip.feasible && (!focusNeed || plan.assignments.find((a) => a.unitId === d.unitId)?.needId === focusNeed))
    .slice(0, focusNeed ? 60 : 40)
    .map((d) => ({ id: d.unitId, coords: d.trip.coords, color: d.trip.method === 'boat' ? 'var(--info)' : d.trip.method === 'foot-crossing' ? 'var(--caution)' : 'var(--sim)', width: 1.5, dash: d.trip.method === 'graph' ? undefined : '3 3' }));

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Dispatcher · demo mode" title="Rescue Resource Coordination">
        Review demand, inspect units, assign and reassign. Every change recalculates coverage and is written to an auditable log stored on this device. Assignments are <strong className="text-sim">simulated</strong> — nothing is dispatched in the real world.
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs label="Scenario" value={def.id} onChange={selectScenario} tabs={SCENARIOS.map((s) => ({ value: s.id, label: s.shortTitle }))} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">{Object.keys(manual).length} manual change(s)</span>
          <Button size="sm" variant="ghost" onClick={resetDispatch} disabled={!Object.keys(manual).length && !log.length}><RotateCcw className="size-3.5" aria-hidden /> Reset to planner</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[{ label: 'RAAH planner', p: auto }, { label: 'Uncoordinated baseline', p: baseline }, { label: 'Your dispatch (current)', p: plan }].map(({ label, p }) => (
          <div key={label} className={cx('rounded-xl border p-3', label.startsWith('Your') ? 'border-accent/50 bg-accent/5' : 'border-line bg-surface')}>
            <p className="text-xs font-semibold text-ink">{label}</p>
            <p className="tabular mt-1 font-mono text-2xl font-semibold text-ink">{p.metrics.coveragePct}%<span className="ml-1 text-xs font-normal text-muted">coverage</span></p>
            <p className="tabular font-mono text-[11px] text-muted">{p.metrics.served.toLocaleString('en')} served · {p.metrics.unmet.toLocaleString('en')} unmet · medical {p.metrics.medicalServed}/{p.metrics.medicalDemand}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)_400px]">
        <Card title="Incident demand" mode="simulated" bodyClassName="scrollbar-thin max-h-[64vh] overflow-y-auto space-y-3">
          {needsBySettlement.map(({ s, needs }) => (
            <div key={s.id} className="rounded-lg border border-line p-2.5">
              <p className="text-xs font-semibold text-ink">{s.name}</p>
              <ul className="mt-1.5 space-y-2">
                {needs.map((n) => {
                  const sv = Math.min(n.demand, served(plan, n.id));
                  const pct = (100 * sv) / Math.max(1, n.demand);
                  return (
                    <li key={n.id}>
                      <button onClick={() => setFocusNeed(focusNeed === n.id ? null : n.id)} className={cx('w-full rounded-md p-1.5 text-left hover:bg-surface-2', focusNeed === n.id && 'bg-accent/10')} aria-pressed={focusNeed === n.id}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-ink-2">{n.label}{n.isolated ? ' · isolated' : ''} · weight {n.weight}</span>
                          <span className="tabular font-mono text-ink">{Math.round(sv).toLocaleString('en')}/{n.demand.toLocaleString('en')}</span>
                        </div>
                        <Meter value={pct} label={`${n.label} coverage`} color={pct >= 90 ? 'var(--ok)' : pct >= 60 ? 'var(--caution)' : 'var(--critical)'} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Card>

        <div className="min-w-0 space-y-3">
          <div className="relative h-[46vh] min-h-[340px]">
            <PakMap view={def.view} layers={{ provinces: true, rivers: true, roads: true, labels: true }} closedEdges={current.closedEdges} overlay={<><HazardLayer state={current} def={def} /><RouteLines routes={routes} /></>} screenOverlay={<ScenarioMarkers def={def} plan={plan} state={current} />} ariaLabel="Dispatch map" />
          </div>
          <div className="panel px-3 py-2.5"><Slider label="Scenario clock (unit status)" value={params.hour} min={0} max={def.durationH} step={1} unit=" h" onChange={(v) => setParams({ hour: v })} /></div>
          <Card title="Audit log" subtitle="Dispatcher actions (this device) and planner events. Newest first." bodyClassName="scrollbar-thin max-h-64 overflow-y-auto">
            <ol className="space-y-1.5 text-xs">
              {[...log, ...plannerLog].map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cx('w-20 shrink-0 font-mono text-[10.5px] uppercase', e.actor === 'dispatcher' ? 'text-accent' : 'text-muted')}>{e.actor}</span>
                  <span className="tabular w-14 shrink-0 font-mono text-muted">T+{e.hour}h</span>
                  <span className="text-ink-2">{e.text}{e.at && <span className="ml-1 text-[10px] text-muted">({new Date(e.at).toLocaleTimeString()})</span>}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card title="Units" mode="simulated" actions={<Tabs label="Unit type" value={typeFilter} onChange={setTypeFilter} tabs={[{ value: 'all', label: 'All' }, { value: 'boat', label: 'Boats' }, { value: 'team', label: 'Teams' }, { value: 'ambulance', label: 'Amb.' }]} />} bodyClassName="scrollbar-thin max-h-[78vh] overflow-y-auto p-0">
          {!units.length && <p className="p-4 text-xs text-muted">No units of this type in the scenario.</p>}
          <ul className="divide-y divide-line">
            {units.map((u) => {
              const a = plan.assignments.find((x) => x.unitId === u.id);
              const need = a && plan.needs.find((n) => n.id === a.needId);
              const st = unitStatus(plan, u.id, params.hour);
              const Icon = TYPE_ICON[u.type];
              const options = plan.needs.filter((n) => (n.kind === 'boat' && u.type === 'boat') || (n.kind === 'team' && u.type === 'team') || (n.kind === 'ambulance' && u.type === 'ambulance'));
              return (
                <li key={u.id} className={cx('px-3 py-2.5', need && focusNeed === need.id && 'bg-accent/5')}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted" aria-hidden />
                    <span className="font-mono text-xs text-ink">{u.id}</span>
                    <span className={cx('ml-auto text-[11px] font-medium capitalize', STATUS_STYLE[st])}>{st.replace('-', ' ')}</span>
                    {a?.source === 'manual' && <span className="rounded bg-accent/15 px-1 text-[10px] text-accent">manual</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">{u.depotName}{a ? ` → ${def.settlements.find((s) => s.id === need?.settlementId)?.name} · ${a.travelH.toFixed(1)} h · +${Math.round(a.contribution)}` : ' · standby'}</p>
                  {a && <details className="mt-1 text-[11px] text-ink-2"><summary className="cursor-pointer text-accent">Why this unit?</summary><p className="mt-1">{a.reason}</p>{a.alternatives.length > 0 && <p className="mt-0.5 text-muted">Alternatives: {a.alternatives.map((x) => `${x.unitId} (${x.travelH.toFixed(1)} h)`).join(', ')}</p>}</details>}
                  <div className="mt-1.5 flex gap-1.5">
                    <label className="sr-only" htmlFor={`as-${u.id}`}>Reassign {u.id}</label>
                    <select id={`as-${u.id}`} value={a?.needId ?? ''} onChange={(e) => assign(u.id, e.target.value || null)} className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface-2 px-2 text-[11px] text-ink">
                      <option value="">— Standby —</option>
                      {options.map((n) => <option key={n.id} value={n.id}>{def.settlements.find((s) => s.id === n.settlementId)?.name} · {n.label}</option>)}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <p className="flex items-center gap-2 text-[11px] text-muted"><Anchor className="size-3.5" aria-hidden /> Allocation: documented greedy heuristic (largest weighted unmet need first, best-contributing suitable unit). Not a proven optimum. <ModeBadge mode="simulated" /></p>
    </div>
  );
}
