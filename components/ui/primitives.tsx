'use client';

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, Loader2, RefreshCw } from 'lucide-react';
import type { DataMode, RiskBand } from '@/lib/domain/types';
import { sourceById } from '@/lib/data/sources';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 font-semibold shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent)]',
  secondary: 'bg-surface-2 text-ink border border-line-strong hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-critical/15 text-critical border border-critical/40 hover:bg-critical/25',
};
const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' };

export function Button({ variant = 'secondary', size = 'md', className, loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button
      className={cx('inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap', variants[variant], sizes[size], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'secondary', size = 'md', className, children, external }: { href: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: ReactNode; external?: boolean }) {
  const cls = cx('inline-flex items-center justify-center rounded-lg transition-colors whitespace-nowrap', variants[variant], sizes[size], className);
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ title, subtitle, actions, mode, children, className, bodyClassName, id }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; mode?: DataMode | 'cached'; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cx('panel min-w-0', className)} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {title && <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>}
              {mode && <ModeBadge mode={mode} />}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- Badges
const MODE_STYLE: Record<DataMode | 'cached', { label: string; cls: string; hint: string }> = {
  live: { label: 'LIVE DATA', cls: 'text-ok border-ok/50 bg-ok/10', hint: 'Retrieved from an external source during this session.' },
  cached: { label: 'CACHED LIVE', cls: 'text-info border-info/50 bg-info/10', hint: 'Last successful live retrieval, stored on this device. Timestamp shown.' },
  historical: { label: 'HISTORICAL', cls: 'text-info border-info/40 bg-info/10', hint: 'Previously observed events or published datasets.' },
  estimated: { label: 'ESTIMATED', cls: 'text-accent-2 border-accent-2/40 bg-accent-2/10', hint: 'Derived analytically from documented inputs.' },
  simulated: { label: 'SIMULATION', cls: 'text-sim border-sim/50 bg-sim/10', hint: 'Synthetic scenario behaviour — not observed data.' },
  assumption: { label: 'ASSUMPTION', cls: 'text-caution border-caution/50 bg-caution/10', hint: 'Documented analyst assumption.' },
  unavailable: { label: 'UNAVAILABLE', cls: 'text-muted border-line-strong bg-surface-2', hint: 'Source could not be reached or validated. Nothing is substituted.' },
};

export function ModeBadge({ mode, className }: { mode: DataMode | 'cached'; className?: string }) {
  const s = MODE_STYLE[mode];
  return (
    <span title={s.hint} className={cx('inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] font-semibold tracking-wider', s.cls, className)}>
      {s.label}
    </span>
  );
}

export const BAND_COLOR: Record<RiskBand, string> = {
  low: 'var(--band-low)',
  moderate: 'var(--band-moderate)',
  high: 'var(--band-high)',
  critical: 'var(--band-critical)',
};

export function RiskBadge({ band, score }: { band: RiskBand; score?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold capitalize" style={{ color: BAND_COLOR[band], borderColor: `color-mix(in srgb, ${BAND_COLOR[band]} 45%, transparent)`, background: `color-mix(in srgb, ${BAND_COLOR[band]} 12%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: BAND_COLOR[band] }} aria-hidden />
      {band}
      {score !== undefined && <span className="tabular font-mono">{score}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- Metric
export function Metric({ label, value, unit, mode, hint, tone, delta, className }: { label: string; value: ReactNode; unit?: string; mode?: DataMode | 'cached'; hint?: string; tone?: 'default' | 'critical' | 'caution' | 'ok' | 'accent'; delta?: { value: number; goodWhen: 'up' | 'down'; suffix?: string }; className?: string }) {
  const toneCls = { default: 'text-ink', critical: 'text-critical', caution: 'text-caution', ok: 'text-ok', accent: 'text-accent' }[tone ?? 'default'];
  return (
    <div className={cx('min-w-0 rounded-xl border border-line bg-surface-2/60 px-3.5 py-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] font-medium uppercase leading-tight tracking-wider text-muted" title={hint}>
          {label}
        </span>
        {mode && <ModeBadge mode={mode} />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cx('tabular font-mono text-2xl font-semibold leading-none', toneCls)}>{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
        {delta && delta.value !== 0 && (
          <span className={cx('tabular ml-auto font-mono text-xs', (delta.value > 0) === (delta.goodWhen === 'up') ? 'text-ok' : 'text-critical')}>
            {delta.value > 0 ? '+' : ''}
            {delta.value.toLocaleString('en')}
            {delta.suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Inputs
export function Slider({ label, value, min, max, step, unit, help, onChange, format }: { label: string; value: number; min: number; max: number; step: number; unit?: string; help?: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="tabular rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink">
          {format ? format(value) : value}
          {unit}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 w-full cursor-pointer" aria-describedby={help ? `${id}-help` : undefined} />
      {help && (
        <p id={`${id}-help`} className="text-[11px] leading-snug text-muted">
          {help}
        </p>
      )}
    </div>
  );
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors', checked ? 'border-accent bg-accent/80' : 'border-line-strong bg-surface-3')}>
        <span className={cx('absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
        <span className="sr-only">{label}</span>
      </button>
      <label htmlFor={id} className="cursor-pointer text-xs leading-snug text-ink-2">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-muted">{description}</span>}
      </label>
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  const id = useId();
  return (
    <div className={cx('space-y-1', className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-ink">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-thin flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface-2 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx('whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors', value === t.value ? 'bg-surface-3 text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- States
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-surface-3', className)} aria-hidden />;
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon ?? <Info className="size-6 text-muted" aria-hidden />}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-critical/40 bg-critical/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-critical">
        <AlertTriangle className="size-4" aria-hidden /> {title}
      </div>
      {message && <p className="text-xs text-ink-2">{message}</p>}
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Provenance
export function Provenance({ sourceIds, className }: { sourceIds: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const sources = sourceIds.map((id) => sourceById(id)).filter(Boolean);
  if (!sources.length) return null;
  return (
    <div className={cx('text-[11px] text-muted', className)}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="underline decoration-dotted underline-offset-2 hover:text-ink">
        Sources ({sources.length})
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {sources.map((s) => (
            <li key={s!.id} className="flex flex-wrap items-center gap-1.5">
              <ModeBadge mode={s!.mode} />
              {s!.url.startsWith('http') ? (
                <a href={s!.url} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline underline-offset-2 hover:text-accent">
                  {s!.name}
                </a>
              ) : (
                <Link href={s!.url} className="text-ink-2 underline underline-offset-2 hover:text-accent">
                  {s!.name}
                </Link>
              )}
              <span>· {s!.license}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DemoNotice({ compact }: { compact?: boolean }) {
  return (
    <div role="note" className={cx('flex items-start gap-2 rounded-lg border border-caution/40 bg-caution/10 text-caution', compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-xs')}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="leading-snug">
        <strong>Public demonstration.</strong> RAAH is not an emergency service and is not affiliated with NDMA, PDMA, PMD or Rescue 1122. Scenario outputs are simulations. In an emergency call <a href="tel:1122" className="font-semibold underline">1122</a> or <a href="tel:15" className="font-semibold underline">15</a>.
      </p>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-4">
      {eyebrow && <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
      {children && <div className="mt-1 max-w-3xl text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Thin horizontal meter (0–100). */
export function Meter({ value, color = 'var(--accent)', label }: { value: number; color?: string; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
