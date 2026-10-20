# Progress (evidence-based)

Statuses: Not started · In progress · Implemented · Tested · Verified in deployment · Blocked

| Area | Status | Evidence |
| --- | --- | --- |
| Audit of existing app | Implemented | docs/EXISTING_APP_AUDIT.md (live URL blocked; candidate repo audited) |
| Geodata pipeline + road graph | Tested | scripts/build-geodata.mjs; graph tests |
| Design system + responsive shell | Tested | e2e overflow and navigation tests, desktop + mobile |
| Mission Control | Tested | e2e |
| Risk Intelligence | Tested | unit (risk) + e2e |
| Disaster Simulator (3 scenarios, A/B, clock, share links) | Tested | unit (scenario, url) + e2e |
| Maps & Layers | Tested | e2e |
| Evacuation Planner | Tested | unit (graph) + e2e |
| Rescue Coordination (assign/reassign/audit) | Tested | unit (overrides, status) + e2e |
| Citizen SOS (EN/UR/Roman) | Tested | unit (sos) + e2e |
| Historical Events | Tested | e2e |
| AI Copilot (deterministic + Qwen) | Tested | integration (API, rate limit, Qwen mocked, failure fallback) + e2e |
| Live providers (USGS, Open-Meteo) | Tested | unit normalisation and failure handling; e2e mocked success/failure. Real endpoints not reachable from the build sandbox |
| Offline service worker | Tested | e2e offline test |
| Judge demo `/demo` | Tested | e2e full run + resume after reload |
| Methodology / docs / presentation | Implemented | docs/ |
| Public deployment | Blocked | Needs the owner's Vercel account (see RELEASE_CHECKLIST.md) |
| Licence | Blocked | Needs the owner's choice |
| Real Qwen call | Not verified | No key available; code path covered with a mocked provider |
