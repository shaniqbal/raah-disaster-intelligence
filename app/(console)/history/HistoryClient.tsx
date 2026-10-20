'use client';

import { useState } from 'react';
import type { HazardType } from '@/lib/domain/types';
import { HISTORICAL_EVENTS } from '@/lib/data/historical';
import { HAZARD_LABELS } from '@/lib/risk/engine';
import { regionById } from '@/lib/data/regions';
import { PakMap, Marker } from '@/components/map/PakMap';
import { ModeBadge, SectionTitle, Tabs, cx } from '@/components/ui/primitives';

const COLORS: Record<HazardType, string> = { earthquake: 'var(--sim)', flood: 'var(--info)', urban_flood: 'var(--accent-2)', heatwave: 'var(--band-high)', landslide: 'var(--caution)' };

export function HistoryClient() {
  const [filter, setFilter] = useState<HazardType | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const events = HISTORICAL_EVENTS.filter((e) => filter === 'all' || e.hazard === filter).sort((a, b) => b.date.localeCompare(a.date));
  const selected = HISTORICAL_EVENTS.find((e) => e.id === sel);
  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Reference record" title="Historical Events">
        Thirteen significant events used as reference points by the risk model. Figures are attributed and quoted conservatively; where sources disagree, the range is shown. This is a curated list, not a complete catalogue.
      </SectionTitle>
      <Tabs label="Filter by hazard" value={filter} onChange={setFilter} tabs={[{ value: 'all', label: 'All' }, ...(['earthquake', 'flood', 'urban_flood', 'heatwave', 'landslide'] as HazardType[]).map((h) => ({ value: h, label: HAZARD_LABELS[h] }))]} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="h-[60vh] min-h-[360px] xl:sticky xl:top-20">
          <PakMap
            view={selected ? { center: selected.coord, zoom: 6.6 } : { center: [68.5, 30], zoom: 5.1 }}
            ariaLabel="Historical events map"
            screenOverlay={<g>{events.map((e) => <Marker key={e.id} at={e.coord} r={e.magnitude ? e.magnitude + 1 : 7} shape={e.hazard === 'earthquake' ? 'circle' : 'diamond'} color={COLORS[e.hazard]} label={`${e.title} (${e.date.slice(0, 4)})`} text={e.date.slice(0, 4)} showLabel selected={e.id === sel} onSelect={() => setSel(e.id)} />)}</g>}
          />
        </div>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <article className={cx('panel p-4 transition-colors', e.id === sel && 'border-accent/60')}>
                <button onClick={() => setSel(e.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular font-mono text-xs text-muted">{e.date}</span>
                    <span className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS[e.hazard], background: `color-mix(in srgb, ${COLORS[e.hazard]} 14%, transparent)` }}>{HAZARD_LABELS[e.hazard]}</span>
                    {e.magnitude && <span className="tabular font-mono text-xs text-ink">M{e.magnitude}</span>}
                    <ModeBadge mode="historical" className="ml-auto" />
                  </div>
                  <h2 className="mt-1.5 text-base font-semibold text-ink">{e.title}</h2>
                </button>
                <p className="mt-1 text-sm text-ink-2">{e.summary}</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-2">{e.impacts.map((i) => <li key={i}>{i}</li>)}</ul>
                <p className="mt-2 text-[11px] text-muted">Location: {e.coordNote}</p>
                {e.regions.length > 0 && <p className="text-[11px] text-muted">Linked focus regions: {e.regions.map((r) => regionById(r)?.name).join(', ')}</p>}
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px]">
                  {e.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{s.label}</a>)}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
