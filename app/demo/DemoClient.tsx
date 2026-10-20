'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Expand, Megaphone, NotebookPen, Pause, Play, RotateCcw, X } from 'lucide-react';
import { DEFAULT_SCENARIO as DEF } from '@/lib/scenario/definitions';
import { computePlan, exposureFraction, settlementRadiusKm, stateAt } from '@/lib/scenario/engine';
import { assessRegion } from '@/lib/risk/engine';
import { regionById } from '@/lib/data/regions';
import { getRoadGraph } from '@/lib/geo/data';
import { alternativeRoutes } from '@/lib/geo/graph';
import type { ScenarioParams } from '@/lib/scenario/types';
import type { CopilotAnswer } from '@/lib/copilot/deterministic';
import { encodeScenario } from '@/lib/scenario/url';
import { PakMap, GeoLine, MapLegend, type MapView } from '@/components/map/PakMap';
import { HazardLayer, RouteLines, ScenarioMarkers, SCENARIO_LEGEND } from '@/components/scenario/ScenarioOverlay';
import { Bottlenecks, ComparisonTable, KeyMetrics } from '@/components/scenario/Panels';
import { CoverageChart } from '@/components/scenario/CoverageChart';
import { AnswerView, askCopilot } from '@/components/copilot/CopilotPanel';
import { Logo } from '@/components/shell/Logo';
import { Meter, ModeBadge, RiskBadge, cx } from '@/components/ui/primitives';
import { readStore, writeStore } from '@/components/shell/AppProviders';

const A: ScenarioParams = { ...DEF.defaults };
const B: ScenarioParams = { ...DEF.defaults, responseDelayH: 2, boats: 30 };
const n = (x: number) => Math.round(x).toLocaleString('en');

interface Step {
  id: string;
  title: string;
  kicker: string;
  seconds: number;
  view: MapView;
  notes: string[];
}

const STEPS: Step[] = [
  { id: 'context', title: 'Establish context', kicker: 'Southern Punjab · Indus–Chenab doab', seconds: 25, view: { center: [71.0, 29.95], zoom: 7.4 }, notes: ['Muzaffargarh sits between two of Pakistan’s largest rivers; riverine (kacha) communities flood first.', 'Everything you will see is a simulation built on real geography — Natural Earth rivers and roads.', 'Point at the mode badges: SIMULATION vs ESTIMATED vs HISTORICAL.'] },
  { id: 'rising', title: 'Risk rises', kicker: 'Advancing the scenario clock to the peak', seconds: 24, view: { center: [71.0, 29.95], zoom: 7.4 }, notes: ['The clock runs from hour 0 to the peak at hour 36.', 'River rise widens the illustrative corridor; depth above 1 m closes roads (red dashes).', 'This is not a hydraulic model — it makes logistics concrete and comparable.'] },
  { id: 'exposure', title: 'Assess exposure', kicker: 'Who is affected, and what is cut off', seconds: 24, view: { center: [71.0, 29.95], zoom: 7.6 }, notes: ['Exposure is computed per settlement from distance to the river centreline.', 'Shelter demand and closed roads are derived, not typed in.', 'Populations are order-of-magnitude assumptions, clearly labelled.'] },
  { id: 'warn', title: 'Trigger preparedness', kicker: 'Proposed warnings — nothing is sent', seconds: 22, view: { center: [71.0, 29.95], zoom: 7.4 }, notes: ['RAAH drafts targeted messages in English and Urdu for the warning zone.', 'Stress: no SMS, WhatsApp or government alert is sent. Official channels issue warnings.', 'Coverage shown is the population inside the proposed zone.'] },
  { id: 'evacuate', title: 'Plan evacuation', kicker: 'Shelters and real road routing', seconds: 28, view: { center: [70.95, 30.0], zoom: 7.7 }, notes: ['Routes come from Dijkstra over a 4,000-node road graph with closures removed.', 'Alternatives are genuinely different paths (penalty method) — redundancy matters when a bridge fails.', 'Shelters fill by capacity; flooded shelters are excluded automatically.'] },
  { id: 'allocate', title: 'Allocate rescue resources', kicker: 'Boats, teams and ambulances', seconds: 28, view: { center: [71.05, 30.05], zoom: 7.5 }, notes: ['The planner serves the largest weighted unmet need first, with the unit that adds most capacity.', 'Each assignment records why it was chosen and which alternatives were considered.', 'Bottlenecks fall out of the numbers: boat capacity, shelter access, delay.'] },
  { id: 'whatif', title: 'What if we respond earlier?', kicker: 'A/B: 6 h delay · 20 boats  vs  2 h delay · 30 boats', seconds: 30, view: { center: [71.05, 30.0], zoom: 7.4 }, notes: ['Same hazard, same people — only the response changes.', 'We report operational proxies (coverage, timing, shelter), not lives saved.', 'This is how a district could justify pre-positioning boats.'] },
  { id: 'ai', title: 'Explain with AI', kicker: '“Why was this response plan recommended?”', seconds: 30, view: { center: [71.05, 30.0], zoom: 7.4 }, notes: ['The Copilot answers from computed facts and separates facts, estimates and assumptions.', 'With a Qwen key it adds a narrative; without one it still works — the demo never depends on an API.', 'It cannot dispatch, alert or invent events.'] },
  { id: 'impact', title: 'Impact', kicker: 'From disaster awareness to coordinated action', seconds: 25, view: { center: [69.6, 30.2], zoom: 5.25 }, notes: ['Summarise: hazards assessed, areas visualised, resources allocated, demand covered, bottlenecks.', 'Close with the roadmap: official data integrations and validation with PDMA/Rescue 1122 partners.', '“From disaster awareness to coordinated action.”'] },
];

export function DemoClient() {
  const [step, setStep] = useState(0);
  const [hour, setHour] = useState(0);
  const [auto, setAuto] = useState(false);
  const [notes, setNotes] = useState(false);
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [zoomedIn, setZoomedIn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const s = STEPS[step];

  const planA = useMemo(() => computePlan(DEF, A), []);
  const planB = useMemo(() => computePlan(DEF, B), []);
  const baseline = useMemo(() => computePlan(DEF, { ...A, strategy: 'uncoordinated' }), []);
  const state = useMemo(() => stateAt(DEF, A, hour), [hour]);
  const peak = planA.peak;
  const mzgRisk = useMemo(() => assessRegion(regionById('muzaffargarh')!, 'flood'), []);

  // Resume after refresh/crash.
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get('step'));
    const saved = readStore<number>('raah:demo-step', 0);
    const start = q >= 1 && q <= STEPS.length ? q - 1 : saved;
    setStep(Math.min(Math.max(0, start), STEPS.length - 1));
  }, []);
  useEffect(() => {
    writeStore('raah:demo-step', step);
    window.history.replaceState(null, '', `/demo?step=${step + 1}`);
  }, [step]);

  // Per-step clock behaviour (deterministic, short animations).
  useEffect(() => {
    const id = STEPS[step].id;
    setZoomedIn(false);
    if (id === 'context') {
      setHour(0);
      const t = setTimeout(() => setZoomedIn(true), 900);
      return () => clearTimeout(t);
    }
    if (id === 'rising') {
      setHour(0);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setHour(DEF.peakH);
        return;
      }
      let h = 0;
      const t = setInterval(() => {
        h += 2;
        setHour(Math.min(h, DEF.peakH));
        if (h >= DEF.peakH) clearInterval(t);
      }, 260);
      return () => clearInterval(t);
    }
    setHour(DEF.durationH);
  }, [step]);

  useEffect(() => {
    if (s.id !== 'ai' || answer) return;
    void askCopilot('Why was this response plan recommended?', encodeScenario(DEF, A)).then(setAnswer);
  }, [s.id, answer]);

  const go = useCallback((d: number) => setStep((x) => Math.min(STEPS.length - 1, Math.max(0, x + d))), []);
  const restart = useCallback(() => {
    setAuto(false);
    setAnswer(null);
    setStep(0);
  }, []);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  // Autoplay
  useEffect(() => {
    if (!auto) return;
    if (step === STEPS.length - 1) {
      const t = setTimeout(() => setAuto(false), s.seconds * 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => go(1), s.seconds * 1000);
    return () => clearTimeout(t);
  }, [auto, step, s.seconds, go]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key.toLowerCase() === 'f') fullscreen();
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
      else if (e.key.toLowerCase() === 'p') setAuto((v) => !v);
      else if (e.key.toLowerCase() === 'r') restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, fullscreen, restart]);

  // ---- map overlays per step ----
  const showPlan = ['evacuate', 'allocate', 'whatif', 'ai'].includes(s.id);
  const shelterRoutes = planA.shelterAssignments.filter((x) => x.trip.feasible && x.people > 0 && x.trip.coords.length > 1).map((x) => ({ id: `${x.settlementId}-${x.shelterId}`, coords: x.trip.coords, color: 'var(--accent)', dash: x.trip.method === 'graph' ? undefined : '4 3', width: 2.5 }));
  // Pick the busiest graph-routed evacuation that has a genuinely distinct alternative.
  const altPick = useMemo(() => {
    const closed = new Set(planA.peak.closedEdges);
    const candidates = [...planA.shelterAssignments].filter((x) => x.trip.method === 'graph' && x.people > 0).sort((a, b) => b.people - a.people);
    for (const sa of candidates) {
      const from = DEF.settlements.find((x) => x.id === sa.settlementId)!;
      const to = DEF.shelters.find((x) => x.id === sa.shelterId)!;
      const routes = alternativeRoutes(getRoadGraph(), from.coord, to.coord, closed, 2);
      if (routes.length >= 2 && routes[0].hours <= 4 && routes[1].hours <= 2 * routes[0].hours) return { from, to, routes };
    }
    return null;
  }, [planA]);
  const altDemo = altPick?.routes ?? [];
  const dispatchRoutes = planA.dispatchTrips.filter((d) => d.trip.feasible).slice(0, 50).map((d) => ({ id: d.unitId, coords: d.trip.coords, color: d.trip.method === 'boat' ? 'var(--info)' : 'var(--sim)', width: 1.4, dash: d.trip.method === 'graph' ? undefined : '3 3' }));
  const routes = s.id === 'evacuate' ? [...shelterRoutes.map((r) => ({ ...r, color: 'var(--accent)', width: 1.6 })), ...altDemo.map((r, i) => ({ id: `alt${i}`, coords: r.coords, color: i === 0 ? 'var(--ok)' : 'var(--caution)', width: 4 }))] : s.id === 'allocate' || s.id === 'whatif' ? dispatchRoutes : s.id === 'ai' ? shelterRoutes : [];
  const warnZone = s.id === 'warn' && peak.footprint.kind === 'corridor' ? <GeoLine lines={peak.footprint.lines} color="color-mix(in srgb, var(--caution) 22%, transparent)" widthKm={peak.footprint.halfWidthKm + 4} /> : null;
  const warned = useMemo(() => {
    const fp = peak.footprint;
    if (fp.kind !== 'corridor') return { people: 0, places: [] as string[] };
    const zone = { ...fp, halfWidthKm: fp.halfWidthKm + 4 };
    const inZone = DEF.settlements.filter((x) => exposureFraction(zone, x.coord, settlementRadiusKm(x.population)) > 0);
    return { people: inZone.reduce((a, x) => a + x.population, 0), places: inZone.map((x) => x.name) };
  }, [peak]);

  const view = s.id === 'context' && !zoomedIn ? { center: [69.6, 30.2] as [number, number], zoom: 5.25 } : s.view;

  return (
    <div ref={rootRef} className="flex h-dvh flex-col overflow-hidden bg-bg text-ink">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3 sm:px-4">
        <Link href="/" aria-label="RAAH home" className="hidden sm:block"><Logo /></Link>
        <Link href="/" aria-label="RAAH home" className="sm:hidden"><Logo compact /></Link>
        <ol className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Demo steps">
          {STEPS.map((x, i) => (
            <li key={x.id}>
              <button onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors', i === step ? 'bg-accent text-accent-ink' : i < step ? 'text-ink-2 hover:bg-surface-2' : 'text-muted hover:bg-surface-2')}>
                <span className="tabular font-mono">{i + 1}</span>
                <span className="hidden 2xl:inline">{x.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <span className="tabular ml-auto font-mono text-xs text-muted lg:hidden">{step + 1}/{STEPS.length}</span>
        <div className="flex items-center gap-1">
          <IconBtn label="Previous (←)" onClick={() => go(-1)} disabled={step === 0}><ChevronLeft className="size-4" /></IconBtn>
          <IconBtn label={auto ? 'Pause autoplay (P)' : 'Autoplay (P)'} onClick={() => setAuto((v) => !v)} active={auto}>{auto ? <Pause className="size-4" /> : <Play className="size-4" />}</IconBtn>
          <IconBtn label="Next (→)" onClick={() => go(1)} disabled={step === STEPS.length - 1}><ChevronRight className="size-4" /></IconBtn>
          <IconBtn label="Restart (R)" onClick={restart}><RotateCcw className="size-4" /></IconBtn>
          <IconBtn label="Presenter notes (N)" onClick={() => setNotes((v) => !v)} active={notes}><NotebookPen className="size-4" /></IconBtn>
          <IconBtn label="Fullscreen (F)" onClick={fullscreen}><Expand className="size-4" /></IconBtn>
          <Link href="/mission-control" className="ml-1 hidden rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink sm:block" aria-label="Exit demo"><X className="size-4" /></Link>
        </div>
      </header>
      {auto && <div className="h-0.5 shrink-0 bg-surface-3"><div key={`${step}-${auto}`} className="h-full bg-accent" style={{ animation: `demo-progress ${s.seconds}s linear forwards` }} /></div>}
      <style>{`@keyframes demo-progress{from{width:0}to{width:100%}}`}</style>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,40vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.55fr)_minmax(380px,1fr)] lg:grid-rows-1">
        {/* stage */}
        <div className="relative min-h-[300px] p-2 sm:p-3">
          <PakMap
            view={view}
            minHeight={280}
            layers={{ provinces: true, rivers: true, roads: true, labels: true }}
            closedEdges={s.id === 'context' || s.id === 'impact' ? undefined : state.closedEdges}
            ariaLabel={`Demo step ${step + 1}: ${s.title}`}
            overlay={
              <>
                {warnZone}
                {s.id !== 'context' && s.id !== 'impact' && <HazardLayer state={state} def={DEF} />}
                {s.id === 'impact' && <HazardLayer state={peak} def={DEF} />}
                <RouteLines routes={routes} />
              </>
            }
            screenOverlay={<ScenarioMarkers def={DEF} plan={showPlan ? planA : undefined} state={s.id === 'context' ? stateAt(DEF, A, 0) : state} showDepots={s.id === 'allocate' || s.id === 'whatif'} />}
          />
          <div className="pointer-events-none absolute left-5 top-5 space-y-2">
            <div className="rounded-xl border border-line bg-surface/90 px-3.5 py-2.5 backdrop-blur">
              <div className="flex items-center gap-2"><ModeBadge mode="simulated" /><span className="tabular font-mono text-sm font-semibold">T+{hour}h</span></div>
              <p className="mt-1 text-xs text-ink-2">{state.footprint.magnitudeLabel}</p>
              <div className="mt-1.5 w-48"><Meter value={(100 * hour) / DEF.durationH} label="Scenario clock" color="var(--sim)" /></div>
            </div>
          </div>
          <MapLegend className="absolute bottom-7 right-5 hidden w-60 xl:block" items={SCENARIO_LEGEND} />
        </div>

        {/* story */}
        <aside className="scrollbar-thin min-h-0 overflow-y-auto border-t border-line bg-bg-2 p-4 sm:p-6 lg:border-l lg:border-t-0" aria-live="polite">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Step {step + 1} of {STEPS.length}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{s.title}</h1>
          <p className="mt-1 text-sm text-muted">{s.kicker}</p>
          <div key={s.id} className="fade-up mt-5 space-y-4">
            {s.id === 'context' && (
              <>
                <p className="text-sm leading-relaxed text-ink-2">Muzaffargarh district lies in the doab between the <strong className="text-ink">Indus</strong> and the <strong className="text-ink">Chenab</strong>. In the 2010 floods, embankment breaches inundated large parts of the district. We simulate a hypothetical high-flow event to rehearse the response.</p>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-ink">Muzaffargarh · flood screening</span><RiskBadge band={mzgRisk.riskBand} score={mzgRisk.riskScore} /></div>
                  <p className="mt-2 text-xs text-muted">{mzgRisk.factors.filter((f) => f.dimension === 'hazard' && f.mode !== 'unavailable').map((f) => `${f.label}: ${f.value}`).join(' · ')}</p>
                </div>
                <ul className="space-y-1.5 text-xs text-ink-2">
                  <li><ModeBadge mode="historical" /> Rivers, roads and boundaries: Natural Earth</li>
                  <li><ModeBadge mode="assumption" /> {DEF.settlements.length} settlements ({DEF.settlements.filter((x) => x.synthetic).length} synthetic riverine clusters), {DEF.shelters.length} shelters, {DEF.depots.length} depots</li>
                  <li><ModeBadge mode="simulated" /> Peak river rise {A.riverRiseM} m above bankfull at hour {DEF.peakH}</li>
                </ul>
              </>
            )}
            {s.id === 'rising' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Big label="River rise" value={`${state.footprint.magnitude.toFixed(2)} m`} />
                  <Big label="Corridor half-width" value={`${state.footprint.kind === 'corridor' ? state.footprint.halfWidthKm.toFixed(1) : 0} km`} />
                  <Big label="People exposed" value={n(state.exposedPeople)} tone="critical" />
                  <Big label="Roads closed" value={`${state.closedRoadKm} km`} tone="caution" />
                </div>
                <p className="text-sm leading-relaxed text-ink-2"><strong className="text-ink">Why risk changes:</strong> rise → wider illustrative corridor (0.5 km + 1.8 km per metre) → depth proxy above 1 m closes roads → kacha communities closest to the river are exposed first.</p>
              </>
            )}
            {s.id === 'exposure' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Big label="Exposed" value={n(planA.metrics.exposedPeople)} tone="critical" />
                  <Big label="Seeking shelter" value={n(planA.metrics.shelterDemand)} />
                  <Big label="Roads closed" value={`${planA.metrics.closedRoadKm} km`} tone="caution" />
                </div>
                <ul className="space-y-2">
                  {[...planA.settlements].filter((x) => x.exposedPeople > 0).sort((a, b) => b.exposedPeople - a.exposedPeople).slice(0, 6).map((x) => (
                    <li key={x.settlement.id}>
                      <div className="flex justify-between text-xs"><span className="text-ink-2">{x.settlement.name}{x.deepWater ? ' · deep water' : ''}</span><span className="tabular font-mono text-ink">{n(x.exposedPeople)} · {Math.round(x.exposureFraction * 100)}%</span></div>
                      <Meter value={x.exposureFraction * 100} label={x.settlement.name} color={x.exposureFraction >= 0.6 ? 'var(--critical)' : 'var(--band-high)'} />
                    </li>
                  ))}
                </ul>
                {planA.shelters.some((x) => !x.usable) && <p className="text-xs text-caution">Inside the footprint and unusable: {planA.shelters.filter((x) => !x.usable).map((x) => x.shelter.name).join(', ')}.</p>}
              </>
            )}
            {s.id === 'warn' && (
              <>
                <div className="relative rounded-xl border border-caution/40 bg-caution/5 p-4">
                  <span className="absolute -right-2 -top-3 rotate-6 rounded border-2 border-critical bg-bg px-2 py-0.5 font-mono text-xs font-bold text-critical">NOT SENT · DEMO</span>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-caution"><Megaphone className="size-4" aria-hidden /> Proposed advisory (draft)</p>
                  <p className="mt-2 text-sm text-ink">Flood warning for riverine areas of Muzaffargarh: move to higher ground now. Do not cross moving water. Follow district administration instructions. Emergency: 1122.</p>
                  <p className="urdu mt-2 text-right text-sm text-ink" dir="rtl" lang="ur">مظفرگڑھ کے دریائی علاقوں کے لیے سیلاب کی وارننگ: فوراً اونچی جگہ پر منتقل ہو جائیں۔ بہتے پانی میں داخل نہ ہوں۔ ضلعی انتظامیہ کی ہدایات پر عمل کریں۔ ایمرجنسی: 1122</p>
                  <p className="mt-1 text-[10.5px] text-muted">Urdu draft pending review by a native-speaking emergency professional.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Big label="Settlements in warning zone" value={String(warned.places.length)} />
                  <Big label="Assumed population covered" value={n(warned.people)} />
                </div>
                <p className="text-xs text-muted">Warning zone = peak footprint + 4 km buffer (amber band). RAAH does not send SMS, WhatsApp or government alerts — official warnings come from NDMA, PDMA and district administrations.</p>
              </>
            )}
            {s.id === 'evacuate' && (
              <>
                <ul className="space-y-1.5">
                  {planA.shelters.map((x) => (
                    <li key={x.shelter.id}>
                      <div className="flex justify-between text-xs"><span className={x.usable ? 'text-ink-2' : 'text-muted line-through'}>{x.shelter.name}</span><span className="tabular font-mono text-ink">{x.usable ? `${n(x.assigned)} / ${n(x.capacity)}` : 'unusable'}</span></div>
                      {x.usable && <Meter value={(100 * x.assigned) / x.capacity} label={x.shelter.name} color={x.assigned >= x.capacity ? 'var(--caution)' : 'var(--ok)'} />}
                    </li>
                  ))}
                </ul>
                {altDemo.length > 1 && (
                  <div className="rounded-xl border border-line bg-surface p-3 text-xs">
                    <p className="font-semibold text-ink">{altPick?.from.name} → {altPick?.to.name}</p>
                    <p className="mt-1 text-ink-2"><span className="text-ok">●</span> Fastest: {altDemo[0].km.toFixed(0)} km · {altDemo[0].hours.toFixed(1)} h &nbsp; <span className="text-caution">●</span> Alternative: {altDemo[1].km.toFixed(0)} km · {altDemo[1].hours.toFixed(1)} h</p>
                    <p className="mt-1 text-muted">Dijkstra over open road segments; the alternative avoids the fastest route’s segments (penalty method).</p>
                  </div>
                )}
                <p className="text-xs text-caution">Planning illustration — not verified navigation.</p>
              </>
            )}
            {s.id === 'allocate' && (
              <>
                <KeyMetrics plan={planA} />
                <Bottlenecks plan={planA} />
              </>
            )}
            {s.id === 'whatif' && (
              <>
                <ComparisonTable a={planA} b={planB} labelA="6 h delay · 20 boats" labelB="2 h delay · 30 boats" />
                <CoverageChart series={planA.series} compare={planB.series} height={150} label="Served over time: plan A vs plan B" />
                <p className="text-xs text-muted">For reference, an uncoordinated nearest-first response with plan A’s resources reaches {baseline.metrics.coveragePct}% coverage vs {planA.metrics.coveragePct}% for the RAAH planner.</p>
              </>
            )}
            {s.id === 'ai' && (answer ? <div className="rounded-xl border border-line bg-surface p-4"><AnswerView answer={answer} /></div> : <p className="text-sm text-muted">Assembling an evidence-based answer…</p>)}
            {s.id === 'impact' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Big label="Hazards assessed" value="5" />
                  <Big label="Regions screened" value="18" />
                  <Big label="Units allocated" value={`${planB.metrics.unitsDeployed}`} />
                  <Big label="Demand covered (plan B)" value={`${planB.metrics.coveragePct}%`} tone="ok" />
                </div>
                <div className="text-sm text-ink-2">
                  <p className="font-semibold text-ink">Bottlenecks surfaced</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{planA.bottlenecks.filter((b) => b.severity !== 'info').map((b) => <li key={b.id}>{b.title}</li>)}</ul>
                  <p className="mt-3 font-semibold text-ink">Preparedness opportunities</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    <li>Starting 4 h earlier with 10 more boats raises coverage from {planA.metrics.coveragePct}% to {planB.metrics.coveragePct}%.</li>
                    <li>Coordinated allocation beats an uncoordinated response by {Math.round(planA.metrics.coveragePct - baseline.metrics.coveragePct)} points with the same assets.</li>
                    <li>Shelter capacity on high ground and redundant routes are the next constraints.</li>
                  </ul>
                </div>
                <p className="pt-2 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">From disaster awareness to <span className="text-accent">coordinated action.</span></p>
              </>
            )}
          </div>
          <p className="mt-6 text-[10.5px] leading-snug text-muted">Public demonstration with simulated data. Not an emergency service; not affiliated with NDMA, PDMA, PMD or Rescue 1122.</p>
        </aside>
      </div>

      {notes && (
        <div role="complementary" aria-label="Presenter notes" className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-sim/50 bg-surface/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-4 sm:w-[420px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-sim">Presenter notes · ~{s.seconds}s</p>
            <button onClick={() => setNotes(false)} className="text-muted hover:text-ink" aria-label="Close notes"><X className="size-4" /></button>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-2">{s.notes.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-2 text-[11px] text-muted">Keys: → next · ← back · P autoplay · F fullscreen · N notes · R restart</p>
        </div>
      )}
    </div>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone?: 'critical' | 'caution' | 'ok' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[10.5px] uppercase tracking-wider text-muted">{label}</p>
      <p className={cx('tabular mt-1 font-mono text-2xl font-semibold', tone === 'critical' ? 'text-critical' : tone === 'caution' ? 'text-caution' : tone === 'ok' ? 'text-ok' : 'text-ink')}>{value}</p>
    </div>
  );
}

function IconBtn({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cx('rounded-lg p-2 transition-colors disabled:opacity-35', active ? 'bg-accent/20 text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      {children}
    </button>
  );
}
