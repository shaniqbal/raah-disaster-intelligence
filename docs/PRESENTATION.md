# Presentation Package — Islamabad Final

## Slide outline (10 slides)

1. **RAAH — AI Disaster Intelligence.** "Predict. Prepare. Protect." Logo, team (Shan Iqbal · ZZ Tech Labs), and the line: "Public demonstration, not an emergency service."
2. **Pakistan's disaster challenge.** 2022 floods: more than 1,700 deaths and over 33 million people affected (NDMA); the PDNA estimated damages above US$14.9 bn and losses of about US$15.2 bn. 2005 Kashmir earthquake: more than 73,000 deaths. Recurring heatwaves (Karachi 2015; Jacobabad around 50–51 °C in 2022). *Cite sources on the slide.*
3. **Fragmented information.** Risk, maps, shelters and assets live in separate documents, so responses default to nearest-first. Black-box dashboards erode trust.
4. **Our solution.** One workflow: Assess → Simulate → Evacuate → Allocate → Explain. Screenshot of Mission Control.
5. **Architecture.** A single Next.js app; deterministic engines shared by browser and server; Natural Earth geodata pipeline; DataProvider adapters (USGS, Open-Meteo); grounded Copilot (Qwen optional); offline service worker. Use the diagram from `/methodology#architecture`.
6. **Explainable risk.** Formula, factor breakdown and mode badges. Example: Rajanpur flood 55 (high), with its factors.
7. **Digital twin and response simulation.** Three scenarios. Show the A/B result: 79% vs 97.2% coverage, readiness 58 vs 80, and the 65.9% uncoordinated baseline.
8. **Live product demonstration.** Switch to `/demo`.
9. **Technical credibility and limitations.** 62 unit/integration tests and 30 end-to-end tests passing; offline verified; nothing simulated is shown as live; no casualty claims; the list of what is not validated.
10. **Roadmap and impact.** Pilot with one PDMA district: calibrate with after-action data, connect official feeds, add verified shelter and health registries, CAP alerts through authorised channels, responder app. Close: "From disaster awareness to coordinated action."

## Judges' technical Q&A

**Where is the AI?**
In two layers. The first is analytical intelligence: explainable risk screening, a what-if simulation engine, graph routing and a resource-allocation planner that justifies each decision. The second is a grounded Copilot. It turns those computed facts into answers, runs counterfactuals on request, and can use Qwen (Alibaba Cloud Model Studio) to phrase the answer. We deliberately did not let a language model produce numbers.

**Is this genuinely predicting disasters?**
No. It is a preparedness and response-planning tool. The risk index is a relative screening index, and scenarios are hypothetical. Live feeds (USGS earthquakes, Open-Meteo forecasts) are displayed and can adjust risk, but RAAH issues no forecasts or warnings.

**Which datasets are real?**
Natural Earth geography (public domain): boundaries, rivers and a 4,251-node road graph. USGS earthquakes and Open-Meteo forecasts, live when reachable. 13 curated historical events with sources. Verified emergency numbers.

**Which features are simulated?**
Scenario hazard footprints, populations, shelters, depots, unit counts, demand and dispatch. They are always badged SIMULATION.

**How is model accuracy measured?**
For the engines, by 62 automated tests covering correctness, determinism, monotonicity and consistency. The predictive validity of the risk index and footprints is *not yet* measured. The plan is to compare footprints with 2022 satellite flood extents, and risk scores with district loss data from NDMA/PDNA.

**How do you validate risk scores?**
Today they are transparent and reproducible, with every factor shown with its formula and source, but not empirically validated. Validation plan: rank-correlate with historical district impacts, run sensitivity analysis on the weights, and review with PDMA experts.

**How does routing work?**
Dijkstra's shortest path with a binary heap over the Natural Earth major-road graph. Travel time comes from road-class speeds, and closures are removed from the graph. Alternatives use the penalty method. Short urban trips are explicitly estimated because the graph has no local streets. It is not navigation-grade.

**How do you prevent hallucinations?**
The Copilot's facts are computed by the engines and recomputed server-side from validated parameters. The LLM sees only those facts plus the question, under a system prompt that forbids new facts and claims of dispatch. Its text is shown separately as plain text, with no tool access. Without a key, or on failure, a deterministic answer is used.

**What happens without internet?**
After one visit, the service worker serves all routes and scripts. Maps, scenarios, routing, dispatch, SOS and the Copilot (in its local deterministic mode) all keep working. Live feeds show UNAVAILABLE. This is verified by an automated offline test.

**How is citizen information protected?**
The SOS demo stores reports only in the user's browser. It never uploads them, deletes them after 24 h, rounds location to about 1 km by default, and keeps contact optional. There is no analytics and no personal data on the server.

**How would government agencies integrate?**
Through the `DataProvider<T>` interface: PMD forecasts, NDMA/PDMA situation data, verified shelter and health registries. Alerts would go over CAP through authorised channels. Deployment would add authentication and role-based access for district command centres.

**How would it scale nationally?**
The engines are stateless and run client-side. Scenarios are data definitions, so adding districts means adding definitions and data, not code. National street-level routing would move to an OSM-based routing service, and heavy simulation to web workers or server jobs.

**What is technically original?**
An honest-by-design data-mode system. A deterministic flood/urban/landslide response twin on real Pakistani geography. Explainable greedy allocation with recorded alternatives, compared against an uncoordinated baseline. A transparent readiness index. A grounded Copilot that runs counterfactuals. An offline-first judge demo.

**What limitations remain?**
See [LIMITATIONS.md](LIMITATIONS.md): generalised geography, illustrative footprints, uncalibrated assumptions, no authentication, translations pending review.

**What could realistically be deployed next?**
A 3-month district pilot (for example Muzaffargarh or Rajanpur with PDMA Punjab): load real shelter and asset lists, calibrate unit rates from 2022 after-action data, validate footprints against satellite extents, and use RAAH for pre-monsoon tabletop exercises. It would be a planning tool, not a live command system.
