# Demo Script, Speaker Notes & Recovery Plan

All figures below come from the deterministic engine with default parameters (`raah-sim-1.0`). They will be identical on every run.

## A. The guided demo (`/demo`, about 4 minutes)

Controls: **→ / Space** next · **←** back · **P** autoplay · **F** fullscreen · **N** presenter notes · **R** restart. The current step is saved in the URL (`/demo?step=5`) and in local storage, so a refresh or browser crash resumes at the same step.

| # | Step | What the judges see | Say (short) | ~s |
| --- | --- | --- | --- | --- |
| 1 | Establish context | Pakistan zooms to Muzaffargarh between the Indus and Chenab; flood screening score 55 (high); mode badges | "Real geography, simulated event. Every number is labelled." | 25 |
| 2 | Risk rises | Clock runs 0 → 36 h; corridor widens to 6.8 km; exposure counts up to 263,874; closed roads appear | "Rise → wider corridor → depth over 1 m closes roads → kacha areas first." | 24 |
| 3 | Assess exposure | Exposed settlements ranked; 79,162 seeking shelter; 130 km of road closed | "Exposure is computed per settlement, not typed in." | 24 |
| 4 | Trigger preparedness | Draft advisory in English and Urdu, amber warning zone, **NOT SENT · DEMO** stamp | "We draft; official channels warn." | 22 |
| 5 | Plan evacuation | Shelter fill bars; fastest and alternative road routes | "Dijkstra on a 4,251-node road graph, with a genuinely different alternative." | 28 |
| 6 | Allocate resources | Dispatch lines; 79% coverage, 5,541 unmet; bottlenecks | "The greedy planner serves the largest weighted need first, and every choice is explained." | 28 |
| 7 | What-if | A (6 h delay, 20 boats) 79% → B (2 h, 30 boats) 97.2%; readiness 58 → 80; chart overlay | "Same flood, earlier and better resourced: 4,801 more people reached. Operational proxies only." | 30 |
| 8 | Explain with AI | Copilot answer: facts / estimates / assumptions / uncertainty | "It explains; it cannot dispatch or invent." | 30 |
| 9 | Impact | Summary tiles; "From disaster awareness to coordinated action." | Close. | 25 |

## B. Three-minute speaker script (English)

> **Opening (0:00–0:20)**
> In 2022, floods affected more than thirty-three million people in Pakistan. The warnings existed. What districts lacked was a shared picture to turn those warnings into coordinated action. This is RAAH — *the way* — an AI disaster-intelligence platform for Pakistan.
>
> **Problem (0:20–0:40)**
> Today, risk information, maps, shelter lists and rescue resources sit in different places. Under pressure, decisions are made nearest-first and late. And many "AI dashboards" make it worse, with numbers nobody can explain.
>
> **Product (0:40–1:00)**
> RAAH does four things in one place. It screens risk across 18 regions and five hazards with a score you can explain. It simulates an emergency on real Pakistani geography. It routes evacuations over a real road network. And it allocates boats, teams and ambulances, then explains every decision. Every number on screen says whether it is live, historical, estimated or simulated.
>
> **Demo transition (1:00–2:20)** — *press → through steps 1–7*
> Here is a simulated flood between the Indus and the Chenab. As the river rises, the corridor widens, roads close, and riverine communities are exposed first: about two hundred and sixty thousand people in this scenario. RAAH finds shelter for all seventy-nine thousand people seeking it, within four hours by road, and commits sixty-three of its eighty-two rescue units where they add the most. With a six-hour delay and twenty boats, we reach seventy-nine percent of the people who need help. Start four hours earlier with ten more boats, and we reach ninety-seven percent. That is the conversation a district needs before the monsoon, not during it.
>
> **Technical differentiation (2:20–2:45)** — *step 8*
> The AI Copilot answers "why this plan?" from the platform's own computed facts: separating facts, estimates and assumptions, with uncertainty stated. It runs on Qwen when connected, and works fully offline without it. The whole demo runs offline too.
>
> **Close (2:45–3:00)** — *step 9*
> RAAH is honest about what it is: a validated-engineering prototype, ready to be calibrated with PDMA and Rescue 1122 data. From disaster awareness to coordinated action. Thank you.

## C. Demo recovery plan

| Failure | Recovery |
| --- | --- |
| **Venue internet fails** | Open the site once before presenting (any page). The service worker precaches all 13 routes and their scripts, so every page, the simulator, routing and the Copilot keep working offline. The top bar shows "Offline". This is verified by an automated offline test. |
| **Map tiles fail** | Not applicable: the map uses bundled vector data (Natural Earth), not a tile server. |
| **AI provider times out** | Automatic: the Copilot falls back to the deterministic answer after a 12 s server timeout. If the server is unreachable, the browser computes the same answer locally and labels it. |
| **Live feeds (USGS / Open-Meteo) fail** | They show UNAVAILABLE. Risk scores re-normalise without the live factor. Nothing in the demo depends on them. |
| **Browser crashes / tab closed** | Reopen `/demo`: it resumes at the saved step. Or open `/demo?step=N` directly. |
| **Session reset / wrong state** | Press **R** (restart) in the demo. In the simulator, press **Reset**. In the dispatcher, press **Reset to planner**. In SOS, press **Delete all demo reports**. |
| **A demo action errors** | Use **←** then **→** to re-enter the step (each step recomputes deterministically), or jump with the step pills. |
| **Projector resolution issues** | The demo is tested at 1366, 1440 and 1920 widths and on 360/390 px phones. Press **F** for fullscreen. |
| **Last resort** | Run locally: `npm ci && npm run build && npm start`, then open `http://localhost:3000/demo`. No API keys are needed. |

Pre-flight checklist (5 minutes before):
1. Open `/demo?step=1` on the presentation machine while online, then visit `/mission-control` once.
2. Toggle Wi-Fi off and check that `/simulator` still loads.
3. Press **N** and confirm the presenter notes appear. Press **R** to restart.
4. Set the browser zoom to 100% and press **F** for fullscreen.
