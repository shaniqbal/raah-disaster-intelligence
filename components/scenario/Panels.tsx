'use client';

import { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, ChevronDown, Info, Lightbulb } from 'lucide-react';
import { computePlan, type ScenarioPlan } from '@/lib/scenario/engine';
import type { ScenarioDefinition, ScenarioParams } from '@/lib/scenario/types';
import { Meter, ModeBadge, cx } from '@/components/ui/primitives';

const n = (x: number) => Math.round(x).toLocaleString('en');

export function KeyMetrics({ plan, compareTo }: { plan: ScenarioPlan; compareTo?: ScenarioPlan }) {
  const m = plan.metrics;
  const d = (a: number, b?: number) => (b === undefined ? undefined : Math.round(a - b));
  const c = compareTo?.metrics;
  const rows: { label: string; value: string; unit?: string; tone?: string; delta?: number; good?: 'up' | 'down'; hint: string }[] = [
    { label: 'Exposed at peak', value: n(m.exposedPeople), unit: 'people', hint: 'Assumed population inside the illustrative hazard footprint at peak.', delta: d(m.exposedPeople, c?.exposedPeople), good: 'down' },
    { label: 'Need assisted evacuation', value: n(m.assistedDemand), unit: 'people', hint: 'Exposed people × assisted-evacuation share (+ isolation needs).', delta: d(m.assistedDemand, c?.assistedDemand), good: 'down' },
    { label: 'Evacuation coverage', value: `${m.coveragePct}`, unit: '%', tone: m.coveragePct >= 90 ? 'text-ok' : m.coveragePct >= 70 ? 'text-caution' : 'text-critical', hint: 'Served within the scenario window ÷ demand.', delta: c ? Math.round(m.coveragePct - c.coveragePct) : undefined, good: 'up' },
    { label: 'Unmet demand', value: n(m.unmet), unit: 'people', tone: m.unmet > 0 ? 'text-critical' : 'text-ok', hint: 'People needing assisted evacuation not reached in time.', delta: d(m.unmet, c?.unmet), good: 'down' },
    { label: 'Sheltered', value: `${n(m.sheltered)} / ${n(m.shelterDemand)}`, hint: `Usable capacity ${n(m.shelterCapacity)} (${m.shelterUtilPct}% used).`, delta: d(m.sheltered, c?.sheltered), good: 'up' },
    { label: 'Medical transfers', value: `${n(m.medicalServed)} / ${n(m.medicalDemand)}`, hint: 'Completed ambulance transfers ÷ cases.', delta: d(m.medicalServed, c?.medicalServed), good: 'up' },
    { label: 'Median first arrival', value: m.medianFirstArrivalH === null ? '—' : `${m.medianFirstArrivalH}`, unit: 'h', hint: 'Hours from onset until the first unit reaches an affected settlement (includes response delay).' },
    { label: 'Roads closed', value: n(m.closedRoadKm), unit: 'km', hint: 'Natural Earth road segments closed by the footprint or manual closures at peak.' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5" title={r.hint}>
          <p className="text-[10.5px] font-medium uppercase leading-tight tracking-wider text-muted">{r.label}</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className={cx('tabular font-mono text-lg font-semibold leading-none', r.tone ?? 'text-ink')}>{r.value}</span>
            {r.unit && <span className="text-[11px] text-muted">{r.unit}</span>}
            {r.delta !== undefined && r.delta !== 0 && (
              <span className={cx('tabular ml-auto font-mono text-[11px]', (r.delta > 0) === (r.good === 'up') ? 'text-ok' : 'text-critical')}>
                {r.delta > 0 ? '+' : ''}
                {n(r.delta)}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ReadinessCard({ plan }: { plan: ScenarioPlan }) {
  const [open, setOpen] = useState(false);
  const score = plan.readiness.score;
  const color = score >= 75 ? 'var(--ok)' : score >= 50 ? 'var(--caution)' : 'var(--critical)';
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="flex items-center gap-3">
        <div className="relative grid size-16 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-3)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={`${(score / 100) * 97.4} 97.4`} strokeLinecap="round" />
          </svg>
          <span className="tabular font-mono text-lg font-bold" style={{ color }}>
            {score}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Disaster Readiness Index</p>
          <p className="text-[11px] leading-snug text-muted">Transparent rubric for this simulated plan — not an official preparedness rating.</p>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
            Explain score <ChevronDown className={cx('size-3 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && (
        <ul className="mt-3 space-y-2">
          {plan.readiness.components.map((c) => (
            <li key={c.id}>
              <div className="flex justify-between text-[11px]">
                <span className="text-ink-2">{c.label}</span>
                <span className="tabular font-mono text-ink">{c.score} × {c.weight}</span>
              </div>
              <Meter value={c.score} label={c.label} color={c.score >= 75 ? 'var(--ok)' : c.score >= 50 ? 'var(--caution)' : 'var(--critical)'} />
              <p className="mt-0.5 text-[10.5px] text-muted">{c.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Bottlenecks({ plan }: { plan: ScenarioPlan }) {
  if (!plan.bottlenecks.length) return <p className="text-sm text-ok">No bottlenecks under the current settings.</p>;
  return (
    <ul className="space-y-2">
      {plan.bottlenecks.map((b) => {
        const Icon = b.severity === 'critical' ? AlertOctagon : b.severity === 'warning' ? AlertTriangle : Info;
        return (
          <li key={b.id} className={cx('flex gap-2.5 rounded-lg border p-2.5', b.severity === 'critical' ? 'border-critical/40 bg-critical/5' : b.severity === 'warning' ? 'border-caution/40 bg-caution/5' : 'border-line bg-surface-2/50')}>
            <Icon className={cx('mt-0.5 size-4 shrink-0', b.severity === 'critical' ? 'text-critical' : b.severity === 'warning' ? 'text-caution' : 'text-muted')} aria-hidden />
            <div>
              <p className="text-xs font-semibold text-ink">{b.title}</p>
              <p className="text-xs leading-snug text-ink-2">{b.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Timeline({ plan, hour }: { plan: ScenarioPlan; hour?: number }) {
  const icon: Record<string, string> = { hazard: 'var(--critical)', closure: 'var(--caution)', dispatch: 'var(--info)', arrival: 'var(--ok)', shelter: 'var(--accent)', note: 'var(--muted)' };
  return (
    <ol className="relative space-y-2.5 border-l border-line pl-4">
      {plan.timeline.map((e, i) => (
        <li key={i} className={cx('relative text-xs', hour !== undefined && e.hour > hour && 'opacity-45')}>
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-bg" style={{ background: icon[e.kind] }} aria-hidden />
          <span className="tabular mr-2 font-mono text-muted">T+{e.hour}h</span>
          <span className="text-ink-2">{e.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ A/B comparison
export type PresetId = 'early' | 'late' | 'boats2' | 'teams2' | 'baseline' | 'crossing' | 'shelterOff';

export function presetParams(def: ScenarioDefinition, p: ScenarioParams, id: PresetId): { label: string; params: ScenarioParams } {
  switch (id) {
    case 'early':
      return { label: `Earlier response (${p.responseDelayH} h → ${Math.max(0, p.responseDelayH - 4)} h)`, params: { ...p, responseDelayH: Math.max(0, p.responseDelayH - 4) } };
    case 'late':
      return { label: `Delayed response (${p.responseDelayH} h → ${p.responseDelayH + 6} h)`, params: { ...p, responseDelayH: p.responseDelayH + 6 } };
    case 'boats2':
      return { label: `Double boats (${p.boats} → ${p.boats * 2})`, params: { ...p, boats: p.boats * 2 } };
    case 'teams2':
      return { label: `Double rescue teams (${p.teams} → ${p.teams * 2})`, params: { ...p, teams: p.teams * 2 } };
    case 'baseline':
      return { label: 'No coordinated plan (nearest-first baseline)', params: { ...p, strategy: 'uncoordinated' } };
    case 'crossing': {
      const c = def.closures[0];
      return { label: c ? `${c.label} closed` : 'No crossing defined', params: { ...p, closures: c ? [...new Set([...p.closures, c.id])] : p.closures } };
    }
    case 'shelterOff': {
      const big = [...def.shelters].sort((a, b) => b.capacity - a.capacity)[0];
      return { label: `${big.name} unavailable`, params: { ...p, disabledShelters: [...new Set([...p.disabledShelters, big.id])] } };
    }
  }
}

export const PRESETS: PresetId[] = ['baseline', 'early', 'late', 'boats2', 'teams2', 'crossing', 'shelterOff'];

export function ComparisonTable({ a, b, labelA, labelB }: { a: ScenarioPlan; b: ScenarioPlan; labelA: string; labelB: string }) {
  const rows: { label: string; fa: (p: ScenarioPlan) => number; unit?: string; good: 'up' | 'down' }[] = [
    { label: 'Evacuation coverage', fa: (p) => p.metrics.coveragePct, unit: '%', good: 'up' },
    { label: 'People served', fa: (p) => p.metrics.served, good: 'up' },
    { label: 'Unmet assisted evacuation', fa: (p) => p.metrics.unmet, good: 'down' },
    { label: 'People sheltered', fa: (p) => p.metrics.sheltered, good: 'up' },
    { label: 'Unsheltered', fa: (p) => p.metrics.unsheltered, good: 'down' },
    { label: 'Medical transfers completed', fa: (p) => p.metrics.medicalServed, good: 'up' },
    { label: 'Median first arrival (h)', fa: (p) => p.metrics.medianFirstArrivalH ?? NaN, good: 'down' },
    { label: 'Feasible shelter routes', fa: (p) => p.metrics.routesFeasiblePct, unit: '%', good: 'up' },
    { label: 'Readiness index', fa: (p) => p.readiness.score, good: 'up' },
  ];
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead className="text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-2 font-medium">Operational proxy</th>
            <th className="py-2 pr-2 font-medium">A · {labelA}</th>
            <th className="py-2 pr-2 font-medium">B · {labelB}</th>
            <th className="py-2 font-medium">Δ (B − A)</th>
          </tr>
        </thead>
        <tbody className="tabular font-mono">
          {rows.map((r) => {
            const va = r.fa(a);
            const vb = r.fa(b);
            const delta = Math.round((vb - va) * 10) / 10;
            const good = Number.isFinite(delta) && delta !== 0 && (delta > 0) === (r.good === 'up');
            return (
              <tr key={r.label} className="border-b border-line/60">
                <td className="py-1.5 pr-2 font-sans text-ink-2">{r.label}</td>
                <td className="py-1.5 pr-2 text-ink">{Number.isFinite(va) ? `${n(va)}${r.unit ?? ''}` : '—'}</td>
                <td className="py-1.5 pr-2 text-ink">{Number.isFinite(vb) ? `${n(vb)}${r.unit ?? ''}` : '—'}</td>
                <td className={cx('py-1.5', !Number.isFinite(delta) || delta === 0 ? 'text-muted' : good ? 'text-ok' : 'text-critical')}>
                  {Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta.toLocaleString('en')}` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">Operational proxies only. RAAH does not estimate casualties or lives saved — no validated model supports that.</p>
    </div>
  );
}

/** Variant B plan; computed only when `enabled` (e.g. the compare tab is open). */
export function useVariant(def: ScenarioDefinition, params: ScenarioParams, preset: PresetId, enabled = true) {
  return useMemo(() => {
    if (!enabled) return null;
    const v = presetParams(def, { ...params, hour: 0 }, preset);
    return { ...v, plan: computePlan(def, v.params) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, JSON.stringify({ ...params, hour: 0 }), preset, enabled]);
}

// ------------------------------------------------------------------ Multi-role briefs
export function RoleBriefs({ def, plan }: { def: ScenarioDefinition; plan: ScenarioPlan }) {
  const m = plan.metrics;
  const topExposed = [...plan.settlements].filter((s) => s.exposedPeople > 0).sort((a, b) => b.exposedPeople - a.exposedPeople).slice(0, 3);
  const byType = (t: string) => plan.assignments.filter((a) => plan.units.find((u) => u.id === a.unitId)?.type === t).length;
  const total = (t: string) => plan.units.filter((u) => u.type === t).length;
  const flooded = plan.shelters.filter((s) => !s.usable);
  const fullest = [...plan.shelters].filter((s) => s.usable).sort((a, b) => b.assigned / b.capacity - a.assigned / a.capacity)[0];
  const targets = plan.settlements.filter((s) => s.exposureFraction > 0 || s.isolated).map((s) => s.settlement.name);
  const roles = [
    {
      role: 'Incident analyst',
      uses: ['Hazard footprint', 'Settlement exposure', 'Road closures'],
      brief: [
        `Peak: ${plan.peak.footprint.magnitudeLabel}.`,
        `${n(m.exposedPeople)} people exposed; most affected: ${topExposed.map((s) => `${s.settlement.name} (${Math.round(s.exposureFraction * 100)}%)`).join(', ') || 'none'}.`,
        `${n(m.closedRoadKm)} km of road closed; ${m.roadCutSettlements + m.isolatedSettlements} settlement(s) lose road access.`,
      ],
    },
    {
      role: 'Rescue dispatcher',
      uses: ['Needs by settlement', 'Unit locations', 'Road-network travel times'],
      brief: [
        `Deployed ${byType('boat')}/${total('boat')} boats, ${byType('team')}/${total('team')} teams, ${byType('ambulance')}/${total('ambulance')} ambulances.`,
        `Coverage ${m.coveragePct}%; ${n(m.unmet)} people still need assisted evacuation.`,
        m.unitsTotal - m.unitsDeployed > 0 ? `${m.unitsTotal - m.unitsDeployed} unit(s) on standby — no suitable reachable need.` : 'All units committed.',
      ],
    },
    {
      role: 'Medical coordinator',
      uses: ['Medical case estimate', 'Ambulance round-trip times'],
      brief: [
        `${n(m.medicalServed)} of ${n(m.medicalDemand)} medical transfers completed in the window.`,
        plan.bottlenecks.find((b) => b.id === 'air') ? 'Isolated settlements need air or foot medical evacuation (not modelled).' : 'All medical cases are road-reachable.',
      ],
    },
    {
      role: 'Logistics planner',
      uses: ['Shelter capacity', 'Shelter routes', 'Closures'],
      brief: [
        `${n(m.sheltered)} of ${n(m.shelterDemand)} people placed; ${n(m.unsheltered)} without reachable space.`,
        flooded.length ? `Unusable shelters: ${flooded.map((s) => s.shelter.name).join(', ')}.` : 'All shelters usable.',
        fullest ? `Most loaded: ${fullest.shelter.name} (${Math.round((100 * fullest.assigned) / Math.max(1, fullest.capacity))}%).` : '',
      ].filter(Boolean),
    },
    {
      role: 'Public communication',
      uses: ['Affected settlements', 'Shelter assignments'],
      brief: [
        `Draft advisory for ${targets.length} settlement(s): ${targets.slice(0, 4).join(', ')}${targets.length > 4 ? '…' : ''}.`,
        'EN: “Move to higher ground now. Do not cross moving water. Follow district administration instructions.”',
        'UR (draft, pending review): «فوراً اونچی جگہ پر منتقل ہو جائیں۔ بہتے پانی میں داخل نہ ہوں۔ ضلعی انتظامیہ کی ہدایات پر عمل کریں۔»',
        'Nothing is sent. Real alerts must come from NDMA/PDMA channels.',
      ],
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {roles.map((r) => (
        <article key={r.role} className="rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{r.role}</h3>
            <ModeBadge mode="simulated" />
          </div>
          <p className="mt-1 text-[11px] text-muted">Uses: {r.uses.join(' · ')}</p>
          <ul className="mt-2 space-y-1 text-xs leading-snug text-ink-2">
            {r.brief.map((b, i) => (
              <li key={i} className={b.startsWith('UR') ? 'urdu text-right' : undefined} dir={b.startsWith('UR') ? 'rtl' : undefined}>
                {b}
              </li>
            ))}
          </ul>
        </article>
      ))}
      <article className="rounded-xl border border-dashed border-line-strong p-3 text-xs text-muted">
        <div className="flex items-center gap-2 font-semibold text-ink-2">
          <Lightbulb className="size-4 text-accent" aria-hidden /> How these roles work
        </div>
        <p className="mt-1.5 leading-snug">
          Each role is a deterministic module reading the same plan for {def.shortTitle}. No autonomous agents act on their own; recommendations change only when you change inputs.
        </p>
      </article>
    </div>
  );
}
