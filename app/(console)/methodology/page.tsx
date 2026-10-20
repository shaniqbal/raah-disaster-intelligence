import type { Metadata } from 'next';
import Link from 'next/link';
import { SOURCES } from '@/lib/data/sources';
import { SCENARIOS } from '@/lib/scenario/definitions';
import { ENGINE_VERSION } from '@/lib/scenario/engine';
import { RISK_MODEL_VERSION } from '@/lib/risk/engine';
import { ModeBadge, SectionTitle } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Methodology', description: 'How RAAH calculates risk, simulates scenarios, routes evacuations and allocates resources — with data sources and limitations.' };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel scroll-mt-20 p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const Eq = ({ children }: { children: React.ReactNode }) => <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-ink">{children}</pre>;

export default function Page() {
  const toc = [
    ['architecture', 'Architecture'],
    ['modes', 'Data modes'],
    ['risk', 'Risk index'],
    ['scenario', 'Scenario engine'],
    ['routing', 'Routing'],
    ['allocation', 'Resource allocation'],
    ['readiness', 'Readiness index'],
    ['ai', 'AI Copilot'],
    ['sources', 'Data sources'],
    ['validation', 'Validation status'],
    ['limitations', 'Limitations'],
    ['roadmap', 'Roadmap'],
  ];
  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Public methodology explorer" title="How RAAH works">
        Every number in RAAH can be traced to one of the methods below. Model versions: risk <code className="font-mono text-ink">{RISK_MODEL_VERSION}</code>, simulation <code className="font-mono text-ink">{ENGINE_VERSION}</code>.
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Methodology sections" className="xl:sticky xl:top-20 xl:self-start">
          <ul className="flex flex-wrap gap-1.5 xl:flex-col">
            {toc.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">{label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          <Section id="architecture" title="Architecture">
            <p>RAAH is a single Next.js (App Router, TypeScript strict) application. All computation is deterministic TypeScript that runs both in the browser and on the server, so the core demo works offline.</p>
            <svg viewBox="0 0 860 300" className="h-auto w-full" role="img" aria-label="Architecture diagram">
              <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--muted)" /></marker></defs>
              {[
                { x: 20, y: 20, w: 190, h: 56, t: 'Natural Earth (PD)', s: 'build-geodata.mjs → bundled JSON' },
                { x: 20, y: 122, w: 190, h: 56, t: 'Live providers', s: 'USGS · Open-Meteo (timeouts)' },
                { x: 20, y: 224, w: 190, h: 56, t: 'Curated records', s: 'historical events · contacts' },
                { x: 290, y: 20, w: 220, h: 56, t: 'Geo layer', s: 'projection · road graph · Dijkstra' },
                { x: 290, y: 122, w: 220, h: 56, t: 'Domain engines', s: 'risk · scenario · allocation' },
                { x: 290, y: 224, w: 220, h: 56, t: 'Copilot', s: 'deterministic facts → optional Qwen' },
                { x: 600, y: 20, w: 240, h: 56, t: 'UI (React)', s: 'Mission Control · Simulator · Demo' },
                { x: 600, y: 122, w: 240, h: 56, t: 'Offline layer', s: 'service worker · localStorage' },
                { x: 600, y: 224, w: 240, h: 56, t: 'API routes (server)', s: '/api/copilot · /api/health' },
              ].map((b) => (
                <g key={b.t}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="var(--surface-2)" stroke="var(--border-strong)" />
                  <text x={b.x + 12} y={b.y + 24} className="fill-[var(--text)] text-[13px] font-semibold">{b.t}</text>
                  <text x={b.x + 12} y={b.y + 43} className="fill-[var(--muted)] text-[11px]">{b.s}</text>
                </g>
              ))}
              {[[210, 48, 290, 48], [210, 150, 290, 150], [210, 252, 290, 150], [400, 76, 400, 122], [510, 150, 600, 48], [510, 150, 600, 150], [400, 178, 400, 224], [510, 252, 600, 252], [510, 48, 600, 48]].map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={1.2} markerEnd="url(#ar)" />
              ))}
            </svg>
            <p>Interfaces separate presentation, geospatial visualisation, domain rules, simulation, live data providers (<code className="font-mono">DataProvider&lt;T&gt;</code>), provenance and the AI layer, so mock or scenario providers can be swapped for official feeds without UI changes.</p>
          </Section>

          <Section id="modes" title="Data modes">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <li><ModeBadge mode="live" /> retrieved from an external source in this session.</li>
              <li><ModeBadge mode="cached" /> last successful live retrieval, shown with its timestamp.</li>
              <li><ModeBadge mode="historical" /> previously observed events or published datasets.</li>
              <li><ModeBadge mode="estimated" /> derived analytically from documented inputs.</li>
              <li><ModeBadge mode="assumption" /> analyst classification or scenario parameter.</li>
              <li><ModeBadge mode="simulated" /> synthetic scenario behaviour.</li>
              <li><ModeBadge mode="unavailable" /> source unreachable — never silently replaced.</li>
            </ul>
          </Section>

          <Section id="risk" title="Risk index (relative screening)">
            <Eq>{`risk = 100 · (H/10)^0.5 · (E/10)^0.3 · (A/10)^0.2        bands: <30 low · 30–50 moderate · 50–70 high · ≥70 critical

Flood H      = 0.40·river proximity + 0.35·historical + 0.25·live 3-day rain   (unavailable factors dropped, weights re-normalised)
  river proximity = 10·e^(−d/15 km) from Natural Earth centrelines; analyst score if the local river is missing from the dataset
  historical      = 0 events → 0, 1 → 6, 2+ → 9 (curated list)
  live rain       = min(10, mm ÷ 15)
Urban flood H = 0.30·urban surface + 0.25·urban channel + 0.20·historical + 0.25·live rain (mm ÷ 10)
Earthquake H  = 1.4 · (c1 + 0.3·c2),  c = (M − 5)·2.5·e^(−d/200 km) over historical epicentres
Heatwave H    = 0.5·(3 × heat class) + 0.2·historical + 0.3·clamp((Tmax − 35)·0.8)
Landslide H   = 0.55·terrain + 0.2·historical + 0.25·live rain (mm ÷ 12)
E (exposure)  = 2 × city size class (1–5)
A (access)    = clamp(10 − road segments within 30 km ÷ 6 + snap distance ÷ 2 (+2 mountain), 0.5, 10)`}</Eq>
            <p>A weighted geometric mean (as in INFORM-style indices) means zero hazard gives zero risk. The index ranks regions <em>relative to each other</em>; it is not a probability, forecast or official rating. The earthquake proxy is not a probabilistic seismic hazard assessment — the Building Code of Pakistan seismic zoning is the authoritative reference.</p>
          </Section>

          <Section id="scenario" title="Scenario engine (digital twin)">
            <p>Three scenarios: {SCENARIOS.map((s) => s.shortTitle).join(', ')}. For each hour <em>t</em>:</p>
            <Eq>{`intensity I(t) = smoothstep(t / t_peak)   (1 after the peak)
riverine:  rise(t) = rise_peak · I(t);   half-width w = 0.5 km + 1.8 km/m · rise;   depth(d) = rise · (1 − d/w)
pluvial:   excess = max(0, rain·I(t) − 60 mm); w = 0.1 km + 0.004 km/mm · excess;  depth(d) = excess/150 · (1 − d/w)
landslide: slide active if severity ≥ threshold and t ≥ activation;  blocked radius = 1 km + 2 km · severity

settlement = disk of radius r = 0.5 + √(pop / 50 000) km
exposed fraction = clamp((w − (d − r)) / 2r, 0, 1)            (d = distance to river/channel centreline)
road segment closed if depth(midpoint) > 1 m (0.3 m urban);   bridges + approaches within 12 km close at the "bridges close at" level
boats needed where depth at the settlement centre > 1 m or the settlement has no road to any depot`}</Eq>
            <p>Footprints are <strong>illustrative corridors</strong> around real Natural Earth river centrelines (or a schematic channel), not hydraulic inundation models. They exist to make response logistics concrete and comparable.</p>
          </Section>

          <Section id="routing" title="Routing">
            <p>The road graph is built from Natural Earth 1:10m roads clipped to Pakistan: vertices are snapped to 0.001°, line ends within 2.5 km are joined, and the largest connected component is kept (~4,250 nodes). Routes use Dijkstra with a binary heap; travel time uses 70 km/h for major highways and 45 km/h for other roads, plus access legs (1.3× straight line at 30 km/h). Alternatives use the penalty method (edges of found routes ×3, routes sharing &gt;70% of length discarded). Trips under 15 km are estimated as 1.35× straight line at 25 km/h because the graph has no local streets; crossing an active flood corridor adds a 2.2× detour.</p>
          </Section>

          <Section id="allocation" title="Resource allocation">
            <Eq>{`needs: boat evacuation (weight 1.5), land evacuation (1.0), medical transfer (2.0); ×1.3 if isolated
unit contribution = rate × max(0, window − delay − travel)
  boat 6.7 people/h · team 15 people/h (5/h after an 8 h foot crossing) · ambulance 1 / (2·travel + 0.75 h)
repeat: pick the need with the largest remaining × weight;
        assign the free suitable unit with the largest contribution (ties: shorter travel, then id)
baseline: every unit goes to the nearest affected settlement it can serve, ignoring coverage`}</Eq>
            <p>This greedy heuristic is deterministic, explainable (each assignment records alternatives considered) and fast, but it is <strong>not a proven optimum</strong>. Shelter assignment fills the fastest reachable shelters (within 4 h) in order of settlement exposure; the baseline sends everyone to the nearest shelter by straight line, ignoring capacity and closures.</p>
          </Section>

          <Section id="readiness" title="Disaster Readiness Index">
            <p>Equal-weight average (20% each) of: shelter coverage, response coverage, route redundancy (a distinct alternative ≤2× best time), timeliness (first unit within 6 h) and road connectivity. It describes a <em>simulated plan</em>, not an official preparedness rating.</p>
          </Section>

          <Section id="ai" title="AI Copilot">
            <p>The Copilot classifies the question into an intent, then assembles an answer from structured state — risk factors, the scenario plan (recomputed server-side from validated parameters), counterfactual re-runs and the source registry. Facts are tagged as verified, estimate, assumption or advice. If <code className="font-mono">DASHSCOPE_API_KEY</code> is configured, Qwen (Alibaba Cloud Model Studio) may rephrase those facts under a strict system prompt; its text is shown separately as plain text. No model output can trigger actions. Without a key, offline or on error, the deterministic answer is returned — the demo never depends on an AI API.</p>
          </Section>

          <Section id="sources" title="Data sources">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-muted"><tr className="border-b border-line"><th className="py-2 pr-2">Source</th><th className="pr-2">Mode</th><th className="pr-2">License</th><th className="pr-2">Updates</th><th>Limitations</th></tr></thead>
                <tbody>
                  {SOURCES.map((s) => (
                    <tr key={s.id} className="border-b border-line/60 align-top">
                      <td className="py-2 pr-2">{s.url.startsWith('http') ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{s.name}</a> : <Link href={s.url} className="text-accent underline">{s.name}</Link>}<span className="block text-muted">{s.provider}</span></td>
                      <td className="pr-2"><ModeBadge mode={s.mode} /></td>
                      <td className="pr-2">{s.license}</td>
                      <td className="pr-2">{s.updateFrequency}</td>
                      <td className="text-ink-2">{s.limitations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="validation" title="Validation status">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Verified by automated tests:</strong> geometry, routing, closures, allocation determinism, state transitions, URL encoding, provider normalisation and failure handling.</li>
              <li><strong>Not validated:</strong> the risk index against observed losses; scenario footprints against hydraulic models; unit rates against operational data. No machine-learning model is trained or claimed.</li>
              <li><strong>Next validation steps:</strong> compare flood footprints with satellite-derived 2022 flood extents; calibrate unit rates with Rescue 1122/PDMA after-action data; replace analyst classes with census-based gridded population and official seismic zoning.</li>
            </ul>
          </Section>

          <Section id="limitations" title="Known limitations">
            <ul className="list-disc space-y-1 pl-5">
              <li>Natural Earth roads and rivers are generalised; local streets, smaller rivers and nullahs are missing.</li>
              <li>Populations, shelters and assets in scenarios are assumptions; some settlements are synthetic clusters.</li>
              <li>Boundaries are Natural Earth de facto lines and not authoritative.</li>
              <li>Live providers can be unavailable; then their factors are excluded.</li>
              <li>Urdu and Roman Urdu text is pending review by native-speaking emergency professionals.</li>
              <li>RAAH is not connected to any emergency service and does not send alerts.</li>
            </ul>
          </Section>

          <Section id="roadmap" title="Roadmap (planned, not built)">
            <ul className="list-disc space-y-1 pl-5">
              <li>Official NDMA/PDMA/PMD data integrations and CAP-compatible alert exchange.</li>
              <li>Satellite flood-extent ingestion and validated hydraulic footprints.</li>
              <li>Verified shelter and health-facility registries; OSM-based street-level routing.</li>
              <li>Responder mobile app, authentication and role-based access for district command centres.</li>
              <li>SMS / WhatsApp notifications through authorised providers only.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
