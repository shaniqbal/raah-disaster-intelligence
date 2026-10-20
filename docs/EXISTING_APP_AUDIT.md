# Existing App Audit

Audit date: 2026-10-20 · Auditor: RAAH engineering (for Shan Iqbal, ZZ Tech Labs)

## 0. What could and could not be inspected

| Target | Result |
| --- | --- |
| Live deployment `https://ai-disaster-app-five.vercel.app/` | **Not reachable from the build environment.** The sandbox network policy blocked the host (`CONNECT tunnel failed, 403`; web fetch: `ENOTFOUND`). No page of the live site was inspected, and no screenshots of it exist. |
| GitHub account `shaniqbal` | 37 repositories listed; **none** named `ai-disaster-app` or matching the deployment. |
| Public search for `ai-disaster-app` | `anammajid88-png/ai-disaster-app` — "AI Disaster App for Alibaba Cloud AI Hackathon Pakistan 2026" (single commit, 2026-09-03, author Anam Majid). |
| Link between that repo and the Vercel URL | **Unverified.** The Vercel project name `ai-disaster-app-five` is consistent with a project called `ai-disaster-app`, and the repo's metadata targets `ai-disaster-app.vercel.app`, but no deployment metadata ties them together. Treat it as the *probable* source only. |

Everything below about the "existing app" refers to that candidate repository, inspected read-only.

## 1. What exists and works (verified locally)

- **Stack:** React 18 + Vite 5 client, Express 4 server, Vercel serverless entry (`api/index.js`). Plain CSS with design tokens.
- **Build:** `npm run setup && npm run build` succeeded (Vite, ~1.6 s).
- **Tests:** `npm test` passed — a content validator plus language/disaster-detection regression cases.
- **AI:** Alibaba Cloud Model Studio (Qwen) through the OpenAI-compatible endpoint, with a stored-guidance fallback when there is no key or the provider fails. Responses carry `source: "ai" | "fallback"`. This is a sound pattern, and RAAH keeps it.
- **Content:** six hazard categories with step-by-step guidance in English, Urdu and Hindi; verified emergency contacts with source URLs and a verification date (2026-02-01); a 10-item emergency kit.
- **PWA:** service worker caches the shell and guidance; AI is clearly online-only.
- **Security basics:** `helmet`, CORS allow-list, in-memory rate limit, input validation, secrets read server-side only.

## 2. What exists but is broken or weak

- `npm audit --omit=dev`: **5 vulnerabilities (1 critical, 1 high, 3 moderate)** in server dependencies (`proxy-addr`, `compression`, `qs` via Express).
- **No geospatial capability at all:** no map, no risk model, no simulation, no routing, no resource coordination.
- **No data provenance modes:** there is nothing to distinguish live, estimated or simulated values; there is simply no live hazard data.
- Hindi is included, although the competition audience is Pakistan-focused; Roman Urdu is detected but not offered as a UI language.
- **No licence file** — the content cannot be safely copied into a new public repository without the author's permission.

## 3. What needs major improvement

The candidate is a well-made emergency guidance chatbot. It is not a disaster-intelligence platform. The competition brief needs explainable risk, scenario simulation, evacuation routing, resource allocation, a judge demo and offline reliability, and none of these exist.

## 4. Reusable

| Item | Decision | Notes |
| --- | --- | --- |
| Qwen provider pattern (timeout, error classes, fallback) | **Refactor** | Re-implemented in TypeScript (`lib/copilot/qwen.ts`), restricted to rephrasing deterministic facts. |
| Emergency numbers + sources | **Retain (facts)** | Numbers and official URLs are facts; reused with attribution in `lib/data/contacts.ts`. |
| Guidance prose & translations | **Not copied** | No licence. RAAH ships its own short guidance, with Urdu/Roman Urdu flagged as pending review. Migration is possible once the author grants permission. |
| PWA idea | **Rebuild** | New service worker precaches every route and its chunks. |
| Express server | **Remove** | Next.js route handlers cover `/api/copilot` and `/api/health`, which removes the vulnerable Express dependency chain. |

## 5. Must be rewritten

The whole product surface: architecture, design system, maps, risk engine, scenario engine, routing, allocation, citizen SOS, copilot grounding, demo mode, tests and docs.

## 6. Security / privacy concerns found

- Vulnerable server dependencies (above).
- In-memory rate limiting does not hold across serverless instances. This is still true in RAAH and is documented in `SECURITY.md`.

## 7. Data-credibility issues

- None in the existing guidance. It avoids invented numbers and labels stored guidance clearly.
- The risk for a rebuild is fabricated dashboards. RAAH addresses this with mandatory mode labels and no synthetic substitution.

## 8. Proposed (and implemented) architecture

A single Next.js 15 (App Router, TypeScript strict) app with deterministic engines shared by client and server. See [ARCHITECTURE.md](ARCHITECTURE.md).

## 9. Feature priority matrix

| Feature | Priority | Status |
| --- | --- | --- |
| Interactive Pakistan map (offline) | P0 | Implemented, tested |
| Explainable risk index | P0 | Implemented, tested |
| Scenario engine + simulator | P0 | Implemented, tested |
| Evacuation routing (Dijkstra + alternatives) | P0 | Implemented, tested |
| Judge demo `/demo` | P0 | Implemented, e2e-tested |
| Demo-safety labelling | P0 | Implemented, e2e-tested |
| Resource allocation + dispatcher | P1 | Implemented, tested |
| A/B comparison, readiness index | P1 | Implemented, tested |
| Citizen SOS (EN/UR/Roman) | P1 | Implemented, e2e-tested |
| Copilot (deterministic + optional Qwen) | P1 | Implemented, tested (Qwen path mocked) |
| Offline service worker | P1 | Implemented, e2e-tested offline |
| Shareable scenario links | P1 | Implemented, tested |
| Multi-role briefs | P2 | Implemented (deterministic) |
| 3D terrain, voice narration | P2 | Not started |

## 10. Baseline screenshots

Not available: the live site could not be reached from the build environment. Screenshots of the rebuilt product are in [`docs/screenshots/`](screenshots/).
