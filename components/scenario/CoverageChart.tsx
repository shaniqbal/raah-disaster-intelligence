'use client';

import { useId, useState } from 'react';

export interface SeriesPoint {
  hour: number;
  demand: number;
  served: number;
}

/** Accessible SVG area chart: demand vs served over the scenario clock, with a data-table fallback. */
export function CoverageChart({ series, compare, hour, height = 180, label = 'Assisted evacuation over time' }: { series: SeriesPoint[]; compare?: SeriesPoint[]; hour?: number; height?: number; label?: string }) {
  const id = useId();
  const [table, setTable] = useState(false);
  const W = 600;
  const H = height;
  const pad = { l: 44, r: 12, t: 10, b: 24 };
  const maxH = Math.max(...series.map((p) => p.hour), 1);
  const maxY = Math.max(1, ...series.map((p) => p.demand), ...(compare ?? []).map((p) => Math.max(p.demand, p.served)));
  const x = (h: number) => pad.l + ((W - pad.l - pad.r) * h) / maxH;
  const y = (v: number) => H - pad.b - ((H - pad.t - pad.b) * v) / maxY;
  const line = (pts: SeriesPoint[], key: 'demand' | 'served') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.hour).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const area = (pts: SeriesPoint[], key: 'demand' | 'served') => `${line(pts, key)}L${x(pts[pts.length - 1].hour)},${y(0)}L${x(pts[0].hour)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{label}</title>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} stroke="var(--border)" strokeDasharray="2 3" />
            <text x={pad.l - 6} y={y(tk) + 3} textAnchor="end" className="fill-[var(--muted)] text-[10px]">
              {fmt(tk)}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={x(maxH * f)} y={H - 6} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
            {Math.round(maxH * f)}h
          </text>
        ))}
        <path d={area(series, 'demand')} fill="var(--critical)" opacity={0.12} />
        <path d={line(series, 'demand')} fill="none" stroke="var(--critical)" strokeWidth={1.5} />
        <path d={area(series, 'served')} fill="var(--accent)" opacity={0.22} />
        <path d={line(series, 'served')} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {compare && <path d={line(compare, 'served')} fill="none" stroke="var(--sim)" strokeWidth={2} strokeDasharray="5 4" />}
        {hour !== undefined && <line x1={x(hour)} x2={x(hour)} y1={pad.t} y2={H - pad.b} stroke="var(--text-2)" strokeDasharray="3 3" />}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-critical" />People needing assisted evacuation</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" />Served (cumulative)</span>
        {compare && <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-sim" />Served — variant B</span>}
        <button className="ml-auto underline decoration-dotted underline-offset-2 hover:text-ink" onClick={() => setTable((v) => !v)} aria-expanded={table}>
          {table ? 'Hide' : 'Show'} data table
        </button>
      </figcaption>
      {table && (
        <div className="scrollbar-thin mt-2 max-h-48 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-2 text-muted">
              <tr><th className="px-2 py-1">Hour</th><th className="px-2 py-1">Demand</th><th className="px-2 py-1">Served</th>{compare && <th className="px-2 py-1">Served (B)</th>}</tr>
            </thead>
            <tbody className="tabular font-mono">
              {series.map((p, i) => (
                <tr key={p.hour} className="border-t border-line"><td className="px-2 py-1">{p.hour}</td><td className="px-2 py-1">{p.demand.toLocaleString('en')}</td><td className="px-2 py-1">{p.served.toLocaleString('en')}</td>{compare && <td className="px-2 py-1">{compare[i]?.served.toLocaleString('en')}</td>}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
