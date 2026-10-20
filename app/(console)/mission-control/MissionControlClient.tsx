'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Bot, CloudRain, LifeBuoy, Presentation, Route, ShieldAlert, Truck, Waves } from 'lucide-react';
import type { HazardType } from '@/lib/domain/types';
import { assessAll, HAZARD_LABELS } from '@/lib/risk/engine';
import { regionById } from '@/lib/data/regions';
import { HISTORICAL_EVENTS } from '@/lib/data/historical';
import { DEFAULT_SCENARIO } from '@/lib/scenario/definitions';
import { computePlan } from '@/lib/scenario/engine';
import { PakMap, Marker, MapLabels, MapLegend } from '@/components/map/PakMap';
import { RiskExplain } from '@/components/risk/RiskExplain';
import { BAND_COLOR, Card, DemoNotice, Metric, ModeBadge, RiskBadge, SectionTitle, Tabs, Toggle, cx } from '@/components/ui/primitives';
import { useLiveData, usePrefs } from '@/components/shell/AppProviders';

const HAZARDS: HazardType[] = ['flood', 'urban_flood', 'earthquake', 'heatwave', 'landslide'];

export function MissionControlClient() {
  const [hazard, setHazard] = useState<HazardType>('flood');
  const [showQuakes, setShowQuakes] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const { region, setRegion } = usePrefs();
  const { quakes, forecast, liveInputs } = useLiveData();
  const list = useMemo(() => assessAll(hazard, liveInputs), [hazard, liveInputs]);
  const focus = list.find((a) => a.regionId === region);
  const elevated = list.filter((a) => a.riskBand === 'critical' || a.riskBand === 'high');
  const plan = useMemo(() => computePlan(DEFAULT_SCENARIO, DEFAULT_SCENARIO.defaults), []);

  const quakeCount = quakes.data?.length ?? null;
  const strongest = quakes.data?.reduce((m, q) => (q.magnitude > (m?.magnitude ?? 0) ? q : m), quakes.data[0]);
  const wettest = forecast.data?.reduce((m, f) => (f.rain3dMm > (m?.rain3dMm ?? -1) ? f : m), forecast.data[0]);

  const signals = [
    ...(quakes.data ?? []).filter((q) => q.magnitude >= 4.5).slice(0, 4).map((q) => ({ id: q.id, mode: quakes.mode === 'cached' ? ('cached' as const) : ('live' as const), title: `M${q.magnitude.toFixed(1)} earthquake`, text: `${q.place} · ${new Date(q.time).toLocaleString()}`, tone: q.magnitude >= 5.5 ? 'critical' : 'caution' })),
    ...(forecast.data ?? []).filter((f) => f.rain3dMm >= 40).slice(0, 4).map((f) => ({ id: `rain-${f.regionId}`, mode: forecast.mode === 'cached' ? ('cached' as const) : ('live' as const), title: `Heavy rain forecast — ${regionById(f.regionId)?.name}`, text: `${f.rain3dMm.toFixed(0)} mm over 3 days (model forecast, not a PMD warning)`, tone: f.rain3dMm >= 80 ? 'critical' : 'caution' })),
    ...plan.bottlenecks.filter((b) => b.severity === 'critical').slice(0, 3).map((b) => ({ id: `sim-${b.id}`, mode: 'simulated' as const, title: `Scenario: ${b.title}`, text: b.detail, tone: 'sim' })),
  ];

  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="National overview" title="Mission Control">
        Explainable risk across Pakistan, live hazard signals where sources respond, and the readiness of the flagship simulated response plan. Each number shows whether it is live, estimated or simulated.
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={`Regions high/critical · ${HAZARD_LABELS[hazard]}`} value={`${elevated.length}/${list.length}`} mode="estimated" hint="Relative screening index — see Risk Intelligence." tone={elevated.length ? 'caution' : 'default'} />
        <Metric label="M4+ earthquakes · 30 days" value={quakeCount === null ? '—' : quakeCount} mode={quakes.mode === 'loading' ? 'unavailable' : quakes.mode} hint={quakes.mode === 'unavailable' ? 'USGS unreachable — not substituted.' : strongest ? `Strongest M${strongest.magnitude.toFixed(1)} · USGS bounding box` : 'USGS FDSN query'} />
        <Metric label="Wettest 3-day forecast" value={wettest ? wettest.rain3dMm.toFixed(0) : '—'} unit={wettest ? 'mm' : undefined} mode={forecast.mode === 'loading' ? 'unavailable' : forecast.mode} hint={wettest ? `${regionById(wettest.regionId)?.name} · Open-Meteo model` : 'Open-Meteo unreachable — risk excludes this factor.'} />
        <Metric label="Readiness · Southern Punjab scenario" value={plan.readiness.score} unit="/100" mode="simulated" hint={`Coverage ${plan.metrics.coveragePct}% · ${plan.metrics.unmet.toLocaleString('en')} unmet`} tone={plan.readiness.score >= 75 ? 'ok' : plan.readiness.score >= 50 ? 'caution' : 'critical'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs label="Hazard" value={hazard} onChange={setHazard} tabs={HAZARDS.map((h) => ({ value: h, label: HAZARD_LABELS[h] }))} />
            <div className="flex flex-wrap gap-4">
              <Toggle label="Live earthquakes" checked={showQuakes} onChange={setShowQuakes} />
              <Toggle label="Historical events" checked={showHistory} onChange={setShowHistory} />
            </div>
          </div>
          <div className="relative h-[58vh] min-h-[380px]">
            <PakMap
              view={region && regionById(region) ? { center: regionById(region)!.coord, zoom: 6.4 } : { center: [69.6, 30.2], zoom: 5.2 }}
              ariaLabel="Mission Control map of Pakistan"
              screenOverlay={
                <g>
                  {showHistory && HISTORICAL_EVENTS.map((e) => <Marker key={e.id} at={e.coord} r={5} shape="diamond" color="var(--info)" label={`${e.title} (${e.date.slice(0, 4)}) — historical`} />)}
                  {showQuakes && quakes.data?.map((q) => <Marker key={q.id} at={q.coord} r={2 + q.magnitude} shape="circle" color="var(--sim)" label={`M${q.magnitude.toFixed(1)} · ${q.place} · ${new Date(q.time).toLocaleDateString()} (${quakes.mode})`} />)}
                  {list.map((a) => {
                    const r = regionById(a.regionId)!;
                    return <Marker key={a.regionId} at={r.coord} r={5 + a.riskScore / 14} color={BAND_COLOR[a.riskBand]} pulse={a.riskBand === 'critical'} label={`${r.name}: ${HAZARD_LABELS[hazard]} ${a.riskBand} (${a.riskScore})`} onSelect={() => setRegion(a.regionId)} selected={a.regionId === region} />;
                  })}
                  <MapLabels items={list.map((a) => ({ id: a.regionId, at: regionById(a.regionId)!.coord, text: regionById(a.regionId)!.name.split(' (')[0], r: 5 + a.riskScore / 13, priority: a.riskScore + (a.regionId === region ? 1000 : 0) }))} />
                </g>
              }
            />
            <MapLegend
              className="absolute bottom-6 left-2 w-56"
              items={[
                ...(['critical', 'high', 'moderate', 'low'] as const).map((b) => ({ label: `Risk: ${b}`, color: BAND_COLOR[b], mode: b === 'critical' ? <ModeBadge mode="estimated" /> : undefined })),
                { label: 'Earthquake (USGS)', color: 'var(--sim)', mode: <ModeBadge mode={quakes.mode === 'loading' ? 'unavailable' : quakes.mode} /> },
                { label: 'Historical event', color: 'var(--info)', shape: 'square' as const },
              ]}
            />
          </div>
          {focus && (
            <Card title="Focus region" mode="estimated" actions={<button className="text-xs text-muted hover:text-ink" onClick={() => setRegion('')}>Clear</button>}>
              <RiskExplain a={focus} />
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card title="Highest relative risk" mode="estimated" actions={<Link href={`/risk?hazard=${hazard}`} className="text-xs text-accent hover:underline">All regions →</Link>}>
            <ul className="space-y-1.5">
              {list.slice(0, 6).map((a) => (
                <li key={a.regionId}>
                  <button onClick={() => setRegion(a.regionId)} className={cx('flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2', a.regionId === region && 'bg-accent/10')}>
                    <span className="tabular w-8 font-mono text-sm font-semibold" style={{ color: BAND_COLOR[a.riskBand] }}>{a.riskScore}</span>
                    <span className="flex-1 text-sm text-ink">{regionById(a.regionId)!.name}</span>
                    <RiskBadge band={a.riskBand} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Signals & alerts" subtitle="Live signals and simulated scenario alerts are labelled separately. RAAH does not issue official warnings.">
            {signals.length ? (
              <ul className="space-y-2">
                {signals.map((s) => (
                  <li key={s.id} className={cx('rounded-lg border p-2.5', s.tone === 'critical' ? 'border-critical/40' : s.tone === 'sim' ? 'border-sim/40' : 'border-caution/40')}>
                    <div className="flex items-center gap-2"><ModeBadge mode={s.mode} /><span className="text-xs font-semibold text-ink">{s.title}</span></div>
                    <p className="mt-1 text-xs text-ink-2">{s.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No signals.</p>
            )}
            {(quakes.mode === 'unavailable' || forecast.mode === 'unavailable') && (
              <p className="mt-2 text-[11px] text-muted">Some live sources are unavailable right now; they are shown as UNAVAILABLE instead of being replaced with synthetic data. <Link href="/live" className="text-accent underline">Check providers</Link></p>
            )}
          </Card>

          <Card title="Act">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/simulator', label: 'Run a what-if', icon: Waves },
                { href: '/evacuation', label: 'Plan evacuation', icon: Route },
                { href: '/resources', label: 'Coordinate rescue', icon: Truck },
                { href: '/copilot', label: 'Ask the Copilot', icon: Bot },
                { href: '/sos', label: 'Citizen SOS (demo)', icon: LifeBuoy },
                { href: '/demo', label: 'Judge demo', icon: Presentation },
                { href: '/live', label: 'Live providers', icon: Activity },
                { href: '/risk', label: 'Risk explorer', icon: ShieldAlert },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="group flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-xs text-ink-2 hover:border-accent/50 hover:text-ink">
                  <Icon className="size-4 text-accent" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </Link>
              ))}
            </div>
          </Card>
          <Card title="Flagship scenario snapshot" mode="simulated" actions={<Link href="/simulator" className="text-xs text-accent hover:underline">Open →</Link>}>
            <p className="text-xs text-ink-2">{DEFAULT_SCENARIO.title}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted">Exposed</dt><dd className="tabular font-mono text-ink">{plan.metrics.exposedPeople.toLocaleString('en')}</dd></div>
              <div><dt className="text-muted">Coverage</dt><dd className="tabular font-mono text-ink">{plan.metrics.coveragePct}%</dd></div>
              <div><dt className="text-muted">Sheltered</dt><dd className="tabular font-mono text-ink">{plan.metrics.sheltered.toLocaleString('en')}</dd></div>
              <div><dt className="text-muted">Roads closed</dt><dd className="tabular font-mono text-ink">{plan.metrics.closedRoadKm} km</dd></div>
            </dl>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted"><CloudRain className="size-3.5" aria-hidden /> Hypothetical inputs — not a forecast of an actual event.</p>
          </Card>
        </div>
      </div>
      <DemoNotice compact />
    </div>
  );
}
