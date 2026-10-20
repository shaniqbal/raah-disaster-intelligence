'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import type { RiskAssessment } from '@/lib/domain/types';
import { HAZARD_LABELS } from '@/lib/risk/engine';
import { regionById } from '@/lib/data/regions';
import { BAND_COLOR, Meter, ModeBadge, Provenance, RiskBadge } from '@/components/ui/primitives';

export function RiskExplain({ a }: { a: RiskAssessment }) {
  const r = regionById(a.regionId)!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">
            {r.name} <span className="urdu text-base text-muted" lang="ur">{r.nameUr}</span>
          </p>
          <p className="text-xs text-muted">{r.province} · {HAZARD_LABELS[a.hazard]} · coordinates {r.coordSource === 'natural-earth' ? 'from Natural Earth' : 'approximate'}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="tabular font-mono text-3xl font-bold" style={{ color: BAND_COLOR[a.riskBand] }}>{a.riskScore}<span className="text-sm text-muted">/100</span></p>
          <RiskBadge band={a.riskBand} />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-2/60 p-3 font-mono text-[11px] text-ink-2">
        risk = 100 · (H/10)<sup>0.5</sup> · (E/10)<sup>0.3</sup> · (A/10)<sup>0.2</sup> = 100 · ({a.hazardScore}/10)<sup>0.5</sup> · ({a.exposureScore}/10)<sup>0.3</sup> · ({a.accessScore}/10)<sup>0.2</sup> ≈ <strong className="text-ink">{a.riskScore}</strong>
        <p className="mt-1 font-sans text-muted">Bands: &lt;30 low · 30–50 moderate · 50–70 high · ≥70 critical. Model {a.modelVersion}.</p>
      </div>

      <div className="space-y-2.5">
        {(['hazard', 'exposure', 'access'] as const).map((dim) => (
          <div key={dim}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {dim === 'hazard' ? `Hazard (H = ${a.hazardScore})` : dim === 'exposure' ? `Exposure (E = ${a.exposureScore})` : `Access constraint (A = ${a.accessScore})`}
            </p>
            <ul className="space-y-2">
              {a.factors.filter((f) => f.dimension === dim).map((f) => (
                <li key={f.id} className="rounded-lg border border-line p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-ink">{f.label}</span>
                    <ModeBadge mode={f.mode} />
                    <span className="tabular ml-auto font-mono text-xs text-ink">{f.mode === 'unavailable' ? '—' : `${f.score}/10`}</span>
                  </div>
                  {f.mode !== 'unavailable' && <div className="mt-1.5"><Meter value={f.score * 10} label={f.label} /></div>}
                  <p className="mt-1.5 text-xs text-ink-2">{f.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{f.explanation}</p>
                  <Provenance sourceIds={f.sourceIds} className="mt-1" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-caution/30 bg-caution/5 p-3 text-xs text-ink-2">
        <p className="font-semibold text-caution">Uncertainty</p>
        <p className="mt-0.5">{a.uncertainty}</p>
        <ul className="mt-1.5 list-disc pl-4 text-muted">{a.assumptions.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Suggested preparedness actions (general guidance)</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-ink-2">{a.actions.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <Link href={`/copilot?q=${encodeURIComponent(`Why is ${r.name} marked ${a.riskBand} risk for ${HAZARD_LABELS[a.hazard].toLowerCase()}?`)}`} className="inline-flex items-center gap-1.5 text-xs text-accent underline">
        <Bot className="size-3.5" aria-hidden /> Ask the Copilot to explain
      </Link>
    </div>
  );
}
