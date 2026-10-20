# Architecture

RAAH is one Next.js 15 application (App Router, React 19, TypeScript strict, Tailwind CSS 4). All analytical logic is deterministic TypeScript. The same code runs in the browser and on the server, so the demo works offline and server answers can be checked against client ones.

```
scripts/build-geodata.mjs ──► data/generated/*.json (Natural Earth → base map + road graph)
                                     │  bundled into the JS (works offline)
lib/geo        projection data, road graph, Dijkstra, alternatives, geometry
lib/data       regions, historical events, sources (provenance registry), contacts
lib/risk       explainable risk index (factors → H/E/A → score → band)
lib/scenario   definitions, hazard footprints, exposure, closures, routing,
               shelter + unit allocation, bottlenecks, readiness, URL codec
lib/providers  DataProvider<T> adapters: USGS FDSN, Open-Meteo (timeouts, zod)
lib/copilot    deterministic explainer + optional Qwen narrative (server only)
lib/citizen    SOS lifecycle (pure functions)
lib/security   rate limiter
components     ui primitives · map (PakMap) · scenario panels · copilot · shell
app            routes (see below) · /api/copilot · /api/health
public/sw.js   offline service worker
```

## Boundaries

| Layer | Location | Rule |
| --- | --- | --- |
| Presentation | `app/`, `components/` | No business logic beyond formatting. Every number shows a mode badge. |
| Geospatial visualisation | `components/map/PakMap.tsx` | d3-geo projection + d3-zoom. Base layers render in map space; markers and labels render in screen space with collision avoidance. |
| Domain model | `lib/domain/types.ts` | `DataMode`, `RiskAssessment`, `RiskFactor`, `HistoricalEvent`, `Region`. |
| Simulation | `lib/scenario/engine.ts` | Pure: `(definition, params, overrides?) → plan`. No I/O, no randomness. |
| Risk scoring | `lib/risk/engine.ts` | Pure: `(region, hazard, live?) → assessment`. |
| Live data | `lib/providers/*` | `DataProvider<T>` with `fetch(signal)`. The UI cache stores the last *real* response; nothing synthetic is ever substituted. |
| Provenance | `lib/data/sources.ts` | Every factor, layer and metric references source ids. |
| Coordination | engine `computePlan` + `/resources` | Dispatcher overrides are applied on top of the planner and persisted per scenario on the device. |
| AI explanation | `lib/copilot/*`, `app/api/copilot` | Facts come from the engines; the LLM may only rephrase them, and its output is plain text. |
| Offline | `public/sw.js`, `localStorage` | Precaches all routes and their chunks; network-first with fallback. |
| Auth / RBAC | — | Not implemented. Not needed for a public read-only demo (see roadmap). |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing: identity, interactive preview, capability overview, honesty statement |
| `/mission-control` | National overview: KPIs with modes, risk map, live signals, scenario alerts, actions |
| `/live` | Provider health, USGS earthquakes, Open-Meteo forecasts, evaluated-but-not-integrated sources |
| `/risk` | Explainable risk explorer (5 hazards × 18 regions) |
| `/simulator` | Digital twin: 3 scenarios, controls, clock, map, outputs, A/B, role briefs, settlements |
| `/map` | Layer explorer with feature info |
| `/evacuation` | Routing with alternatives and closures |
| `/resources` | Dispatcher: needs, units, reassign, audit log, strategy comparison |
| `/sos` | Citizen portal: numbers, preparedness, kit, SOS demo lifecycle (EN/UR/Roman) |
| `/history` | Curated historical events with sources |
| `/copilot` | Grounded Q&A |
| `/methodology` | Public methodology explorer |
| `/demo` | Guided 9-step judge presentation |
| `/api/copilot` | POST, zod-validated, rate-limited; deterministic or Qwen narrative |
| `/api/health` | Engine/model versions and AI provider mode |

## State

- **Scenario state** lives in the URL (`?s=…&rise=…`) and is updated with `history.replaceState`, so there is no server round-trip and links can be shared.
- **Dispatcher overrides and audit log** are kept in `localStorage`, keyed by scenario parameters.
- **SOS reports** are kept in `localStorage` only and purged after 24 h. Locations are rounded to about 1 km by default.
- **Preferences** (theme, language, focus region) are kept in `localStorage`.

## Performance

- The plan is computed against the forecast peak and ignores the clock. Scrubbing the timeline recomputes only the cheap hour state.
- The flood plan takes about 41 ms in Node on a developer machine, using memoised nearest-node lookups and early-exit Dijkstra for the redundancy checks. The A/B variant is computed only when its tab is open.
- Measured Lighthouse results are in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Extension points

- Swap `usgsProvider` / `openMeteoProvider` or add official feeds by implementing `DataProvider<T>`.
- Add scenarios by adding a `ScenarioDefinition`; the UI, demo-safe labels, URL codec and copilot pick them up.
- Replace analyst classes in `lib/data/regions.ts` with official datasets; each factor already carries its `mode` and `sourceIds`.
