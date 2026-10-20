import Link from 'next/link';
import { ArrowRight, BookOpen, Bot, Cpu, Github, LifeBuoy, Presentation, Route, ShieldAlert, ShieldCheck, Truck, WifiOff, Waves } from 'lucide-react';
import { Logo } from '@/components/shell/Logo';
import { LandingMap } from '@/components/landing/LandingMap';
import { ModeBadge } from '@/components/ui/primitives';
import { REGIONS } from '@/lib/data/regions';
import { HISTORICAL_EVENTS } from '@/lib/data/historical';
import { SCENARIOS } from '@/lib/scenario/definitions';
import { ROAD_GRAPH_META } from '@/lib/geo/data';

const REPO = 'https://github.com/shaniqbal/raah-disaster-intelligence';

const FEATURES = [
  { icon: ShieldAlert, title: 'Explainable risk', text: 'Five hazards across 18 regions. Every score decomposes into hazard, exposure and access factors with sources and formulas.', href: '/risk' },
  { icon: Waves, title: 'Disaster digital twin', text: 'What-if simulation for riverine floods, urban flooding and landslides. Change any assumption and watch the plan recompute.', href: '/simulator' },
  { icon: Route, title: 'Evacuation routing', text: 'Dijkstra over a 4,000-node Pakistan road graph with hazard closures and genuine alternative routes — never straight lines.', href: '/evacuation' },
  { icon: Truck, title: 'Rescue coordination', text: 'Assign boats, teams and ambulances; see coverage, bottlenecks and an audit trail. Compare against an uncoordinated baseline.', href: '/resources' },
  { icon: LifeBuoy, title: 'Citizen portal', text: 'Verified emergency numbers, preparedness steps and a privacy-first SOS demo in English, Urdu and Roman Urdu.', href: '/sos' },
  { icon: Bot, title: 'Grounded AI Copilot', text: 'Answers built from the app’s own data — facts, estimates and assumptions kept separate. Optional Qwen narrative; works without any key.', href: '/copilot' },
];

export default function Home() {
  const nodes = (ROAD_GRAPH_META as { keptNodes?: number }).keptNodes ?? 0;
  const stats = [
    { v: REGIONS.length, l: 'regions screened' },
    { v: 5, l: 'hazard types' },
    { v: SCENARIOS.length, l: 'what-if scenarios' },
    { v: nodes.toLocaleString('en'), l: 'road-graph nodes' },
    { v: HISTORICAL_EVENTS.length, l: 'sourced historical events' },
  ];
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="RAAH home"><Logo /></Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 text-sm md:flex">
            <Link href="/mission-control" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">Mission Control</Link>
            <Link href="/simulator" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">Simulator</Link>
            <Link href="/methodology" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">Methodology</Link>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">GitHub</a>
          </nav>
          <Link href="/demo" className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink md:ml-2">
            <Presentation className="size-4" aria-hidden /> <span className="hidden sm:inline">Live demo</span><span className="sm:hidden">Demo</span>
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="grid-bg relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_16%,transparent),transparent)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div className="flex flex-col justify-center">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-accent">Predict · Prepare · Protect</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Disaster intelligence that turns <span className="bg-gradient-to-r from-accent-2 to-accent bg-clip-text text-transparent">warning into action.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
                Explore risks, simulate emergencies, coordinate response and help communities prepare across Pakistan — with every number traceable to its source, formula or assumption.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/mission-control" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-base font-semibold text-accent-ink shadow-[0_0_40px_-8px_var(--accent)]">
                  Explore Mission Control <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-6 text-base text-ink hover:bg-surface-3">
                  <Presentation className="size-4" aria-hidden /> Launch Interactive Demo
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link href="/methodology#architecture" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent"><Cpu className="size-4" aria-hidden /> Explore technology</Link>
                <Link href="/methodology" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent"><BookOpen className="size-4" aria-hidden /> View methodology</Link>
                <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent"><Github className="size-4" aria-hidden /> GitHub repository</a>
              </div>
              <p className="mt-6 max-w-xl rounded-lg border border-caution/40 bg-caution/10 px-3 py-2 text-xs leading-snug text-caution">
                Public demonstration — not an emergency service and not affiliated with NDMA, PDMA, PMD or Rescue 1122. Scenario outputs are simulations. In an emergency call <a href="tel:1122" className="font-semibold underline">1122</a>.
              </p>
            </div>
            <div className="panel relative h-[440px] overflow-hidden p-1.5 sm:h-[520px]">
              <LandingMap />
              <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-1.5">
                <ModeBadge mode="estimated" />
                <ModeBadge mode="simulated" />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Platform scale" className="border-b border-line bg-bg-2">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-5 sm:px-6">
            {stats.map((s) => (
              <div key={s.l}>
                <dt className="text-xs uppercase tracking-wider text-muted">{s.l}</dt>
                <dd className="tabular mt-1 font-mono text-3xl font-semibold text-ink">{s.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mx-auto max-w-7xl px-4 pb-6 text-[11px] text-muted sm:px-6">Counts describe what the platform contains — not incidents. RAAH shows no fabricated real-time counters.</p>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">From awareness to coordinated action</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">One coherent workflow: assess risk, simulate the emergency, plan evacuation, allocate resources and explain every recommendation.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, href }) => (
              <Link key={title} href={href} className="panel group p-5 transition-colors hover:border-accent/50">
                <Icon className="size-6 text-accent" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-accent opacity-80 group-hover:opacity-100">Open <ArrowRight className="size-3" aria-hidden /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-bg-2">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Built to be trusted, not just to impress</h2>
              <ul className="mt-5 space-y-3 text-sm text-ink-2">
                <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />Every value is labelled live, historical, estimated, assumption or simulation — and failed live feeds show as unavailable, never as invented numbers.</li>
                <li className="flex gap-3"><Cpu className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />Deterministic engines: the same inputs always produce the same plan, so results are reproducible and testable.</li>
                <li className="flex gap-3"><Bot className="mt-0.5 size-5 shrink-0 text-sim" aria-hidden />The AI explains, it does not decide: it can only restate facts computed by the platform and cannot dispatch, alert or invent events.</li>
                <li className="flex gap-3"><WifiOff className="mt-0.5 size-5 shrink-0 text-caution" aria-hidden />Offline-first: maps, scenarios, routing and the Copilot fallback are bundled, so the demo survives a venue with no internet.</li>
              </ul>
            </div>
            <div className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Data modes used throughout</p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {(['live', 'historical', 'estimated', 'assumption', 'simulated', 'unavailable'] as const).map((m) => (
                  <li key={m} className="flex items-center gap-3"><ModeBadge mode={m} /><span className="text-ink-2">{{ live: 'USGS earthquakes, Open-Meteo forecasts', historical: 'Natural Earth geography, curated past events', estimated: 'Risk index, routes, travel times', assumption: 'Analyst classes, scenario parameters', simulated: 'Flood corridors, demand, dispatch', unavailable: 'Shown when a source cannot be reached' }[m]}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">See a full flood response in under five minutes</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted">The guided judge demo walks through a simulated Southern Punjab flood: rising risk, exposure, warnings, evacuation, rescue allocation, a what-if comparison and an AI explanation.</p>
          <Link href="/demo" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-base font-semibold text-accent-ink">
            <Presentation className="size-4" aria-hidden /> Start the guided demo
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:px-6">
          <Logo compact />
          <p>RAAH by Shan Iqbal · ZZ Tech Labs. Map data © Natural Earth (public domain). Live data: USGS, Open-Meteo (CC BY 4.0).</p>
          <p className="sm:ml-auto">Not an official warning system.</p>
        </div>
      </footer>
    </div>
  );
}
