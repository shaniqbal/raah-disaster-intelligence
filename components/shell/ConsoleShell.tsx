'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen, Bot, History, Layers, LayoutDashboard, LifeBuoy, Menu, Moon, Presentation, Radio, Route, Search, ShieldAlert, Sun, Truck, Waves, Wifi, WifiOff, X,
} from 'lucide-react';
import { Logo } from './Logo';
import { usePrefs, useLiveData } from './AppProviders';
import { LANGS, t, type StringKey } from '@/lib/i18n/strings';
import { REGIONS } from '@/lib/data/regions';
import { cx } from '@/components/ui/primitives';

export const NAV: { href: string; key: StringKey; icon: typeof LayoutDashboard; group: 'operate' | 'plan' | 'public' | 'about' }[] = [
  { href: '/mission-control', key: 'overview', icon: LayoutDashboard, group: 'operate' },
  { href: '/live', key: 'live', icon: Radio, group: 'operate' },
  { href: '/risk', key: 'risk', icon: ShieldAlert, group: 'operate' },
  { href: '/simulator', key: 'simulator', icon: Waves, group: 'plan' },
  { href: '/map', key: 'map', icon: Layers, group: 'plan' },
  { href: '/evacuation', key: 'evacuation', icon: Route, group: 'plan' },
  { href: '/resources', key: 'resources', icon: Truck, group: 'plan' },
  { href: '/sos', key: 'sos', icon: LifeBuoy, group: 'public' },
  { href: '/history', key: 'history', icon: History, group: 'public' },
  { href: '/copilot', key: 'copilot', icon: Bot, group: 'about' },
  { href: '/methodology', key: 'methodology', icon: BookOpen, group: 'about' },
  { href: '/demo', key: 'demo', icon: Presentation, group: 'about' },
];

const GROUPS = { operate: 'Operate', plan: 'Plan & respond', public: 'Public', about: 'Explain' } as const;

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { lang } = usePrefs();
  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-line px-4">
        <Link href="/" onClick={onNavigate} aria-label="RAAH home">
          <Logo />
        </Link>
      </div>
      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
          <div key={g}>
            <p className="px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{GROUPS[g]}</p>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map(({ href, key, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        active ? 'bg-accent/10 text-ink shadow-[inset_2px_0_0_var(--accent)]' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      <Icon className={cx('size-4 shrink-0', active ? 'text-accent' : 'text-muted group-hover:text-ink-2')} aria-hidden />
                      <span className={lang === 'ur' ? 'urdu text-[13px] leading-6' : undefined}>{t(key, lang)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3 text-[11px] leading-snug text-muted">
        <p className={lang === 'ur' ? 'urdu' : undefined}>{t('demoBanner', lang)}</p>
        <p className="mt-1">
          <a href="tel:1122" className="font-semibold text-caution underline">
            {t('callNow', lang)}
          </a>
        </p>
      </div>
    </nav>
  );
}

function FreshnessIndicator() {
  const { quakes, forecast, refresh } = useLiveData();
  const slots = [
    { name: 'USGS earthquakes', s: quakes },
    { name: 'Open-Meteo forecast', s: forecast },
  ];
  const ok = slots.filter((x) => x.s.mode === 'live').length;
  const loading = slots.some((x) => x.s.mode === 'loading');
  const color = loading ? 'var(--muted)' : ok === 2 ? 'var(--ok)' : ok === 1 || slots.some((x) => x.s.mode === 'cached') ? 'var(--caution)' : 'var(--critical)';
  const label = loading ? 'Checking live feeds…' : ok === 2 ? 'Live feeds OK' : ok === 1 ? 'Live feeds partial' : slots.some((x) => x.s.mode === 'cached') ? 'Using cached live data' : 'Live feeds unavailable';
  const title = slots.map((x) => `${x.name}: ${x.s.mode}${x.s.health.retrievedAt ? ` (retrieved ${new Date(x.s.health.retrievedAt).toLocaleString()})` : ''}`).join('\n');
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/live" title={title} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full opacity-60" style={{ background: color }} />
          <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
        </span>
        {label}
      </Link>
      <button onClick={refresh} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-ink" title="Retry live data providers">
        Refresh
      </button>
    </div>
  );
}

function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const router = useRouter();
  const { setRegion, lang } = usePrefs();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement))) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = NAV.map((n) => ({ kind: 'Page', label: t(n.key, 'en'), href: n.href, region: '' }));
    const regions = REGIONS.map((r) => ({ kind: 'Region', label: `${r.name} · ${r.province}`, href: `/risk?region=${r.id}`, region: r.id }));
    const all = [...pages, ...regions];
    return term ? all.filter((x) => x.label.toLowerCase().includes(term)).slice(0, 10) : all.slice(0, 8);
  }, [q]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-xs text-muted hover:text-ink sm:w-56" aria-label="Search pages and regions">
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search pages, regions…</span>
        <kbd className="ml-auto hidden rounded border border-line-strong px-1.5 font-mono text-[10px] sm:inline">/</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Search" className="panel w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-muted" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) {
                    if (results[0].region) setRegion(results[0].region);
                    router.push(results[0].href);
                    setOpen(false);
                  }
                }}
                placeholder="Type a page or region (e.g. Muzaffargarh)…"
                className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                aria-label="Search query"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    onClick={() => {
                      if (r.region) setRegion(r.region);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <span>{r.label}</span>
                    <span className="font-mono text-[10px] uppercase text-muted">{r.kind}</span>
                  </Link>
                </li>
              ))}
              {!results.length && <li className="px-3 py-6 text-center text-sm text-muted">No matches{lang === 'ur' ? '' : ''}</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, setTheme, lang, setLang, online, region, setRegion } = usePrefs();
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <button onClick={onMenu} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <div className="lg:hidden">
        <Link href="/" aria-label="RAAH home">
          <Logo compact />
        </Link>
      </div>
      <label className="sr-only" htmlFor="region-select">
        Focus region
      </label>
      <select id="region-select" value={region} onChange={(e) => setRegion(e.target.value)} className="hidden h-9 max-w-[200px] rounded-lg border border-line bg-surface-2 px-2.5 text-xs text-ink md:block">
        <option value="">All Pakistan</option>
        {REGIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <CommandSearch />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <FreshnessIndicator />
        <span className="hidden rounded-md border border-sim/40 bg-sim/10 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-sim xl:inline" title="Scenario outputs are simulated. Live feeds are labelled separately.">
          DEMO · SIMULATION
        </span>
        <span title={online ? 'Online' : 'Offline — cached app and bundled data still work'} className={cx('flex items-center gap-1 rounded-md px-2 py-1 text-[11px]', online ? 'text-muted' : 'bg-caution/15 text-caution')}>
          {online ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
          <span className="sr-only sm:not-sr-only">{online ? 'Online' : 'Offline'}</span>
        </span>
        <label className="sr-only" htmlFor="lang-select">
          Language
        </label>
        <select id="lang-select" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink">
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </header>
  );
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only z-[100] rounded bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-line bg-bg-2 lg:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(85vw,300px)] border-r border-line bg-bg-2">
            <button onClick={() => setDrawer(false)} className="absolute right-2 top-4 rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <Topbar onMenu={() => setDrawer(true)} />
        <main id="main" className="mx-auto w-full max-w-[1680px] px-3 py-5 sm:px-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
