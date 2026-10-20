# Model Methodology

Versions: risk `raah-risk-1.0`, simulation `raah-sim-1.0`. The same content is published in the app at `/methodology`.

**No machine-learning model is trained and none is claimed.** RAAH's "AI" consists of two parts. The first is a set of explainable analytical engines (risk screening, simulation, routing, allocation). The second is a grounded language layer, the Copilot, which explains those engines' outputs.

## 1. Risk screening index

```
risk = 100 · (H/10)^0.5 · (E/10)^0.3 · (A/10)^0.2
bands: <30 low · 30–50 moderate · 50–70 high · ≥70 critical
```
- **H (hazard, 0–10)** — hazard-specific, as a weighted average of factors. Unavailable live factors are dropped and the remaining weights re-normalised.
  - Flood: 0.40·river proximity (10·e^(−d/15 km), from Natural Earth; an analyst score if the local river is missing) + 0.35·historical (0 events → 0, 1 → 6, 2+ → 9) + 0.25·live 3-day rain (mm ÷ 15)
  - Urban flood: 0.30·urban surface (2 × size class) + 0.25·urban channel (analyst) + 0.20·historical + 0.25·live rain (mm ÷ 10)
  - Earthquake: 1.4·(c₁ + 0.3·c₂), where c = (M − 5)·2.5·e^(−d/200 km) over the two strongest historical contributors
  - Heatwave: 0.5·(3 × heat class) + 0.2·historical + 0.3·clamp((Tmax − 35)·0.8)
  - Landslide: 0.55·terrain (mountain 8, foothill 4, other 0.5) + 0.2·historical + 0.25·live rain (mm ÷ 12)
- **E (exposure)** = 2 × city size class (1–5, analyst)
- **A (access constraint)** = clamp(10 − road segments within 30 km ÷ 6 + snap distance ÷ 2 (+2 mountain), 0.5, 10), computed from the road graph

A weighted geometric mean, as in INFORM-style indices, gives zero risk when there is zero hazard. The index is relative and unvalidated. Differences under about 10 points should not be over-interpreted.

## 2. Scenario engine

For hour *t*, intensity is `I(t) = smoothstep(t / t_peak)` (1 after the peak).

| Hazard | Magnitude | Footprint | Depth proxy |
| --- | --- | --- | --- |
| Riverine (Indus, Chenab) | rise = rise_peak·I(t) | corridor half-width w = 0.5 km + 1.8 km/m·rise | rise·(1 − d/w) |
| Pluvial (Lai Nullah, schematic) | rain·I(t); excess = max(0, rain − 60 mm) | w = 0.1 km + 0.004 km/mm·excess | excess/150·(1 − d/w) |
| Landslide (KKH) | severity | active slide if severity ≥ threshold and t ≥ activation; radius 1 km + 2 km·severity | — |

- **Exposure:** a settlement is a disk of radius r = 0.5 + √(pop/50 000) km, and exposed fraction = clamp((w − (d − r)) / 2r, 0, 1).
- **Road closures:** a segment closes when the depth at its midpoint exceeds 1 m (0.3 m for urban scenarios). Bridges, and segments within 12 km of a river crossing, are treated as embanked approaches and close only at the user-set "bridges close at" level. Manual closures remove segments within a radius.
- **Boat need:** depth at the settlement centre exceeds 1 m, or the settlement has no road to any depot.
- **Isolation:** no open road path to any depot. Landslide-isolated settlements need outside assistance for 5% of their population, and 0.2% need medical evacuation by air or on foot (flagged, not scheduled).
- **Demand shares (assumptions):** flood — 10% assisted evacuation, 30% public shelter, 0.4% medical transfers; urban — 6% / 20% / 0.4%.

Footprints are **illustrative**: they turn hazard magnitude into comparable logistics problems. They are not hydraulic inundation or geotechnical models.

## 3. Routing

- Graph: Natural Earth roads (see DATA_SOURCES.md).
- Algorithm: Dijkstra with a binary heap. Weights are travel time at 70 km/h for major highways and 45 km/h for other roads.
- Access legs (point → nearest node): 1.3 × straight line at 30 km/h.
- Local trips under 15 km: 1.35 × straight line at 25 km/h. Crossing an active flood corridor or a closed crossing adds a 2.2× detour.
- Alternatives: penalty method (edges of found routes ×3; candidates sharing more than 70% of their length with an earlier route are discarded).
- Shelter trips over 4 h are not assigned; those people count as unsheltered.

## 4. Allocation

- Needs: boat evacuation (weight 1.5), land evacuation (1.0), medical transfers (2.0); ×1.3 when isolated.
- Unit contribution = rate × max(0, window − delay − travel). Rates: boat 6.7 people/h; team 15 people/h (5 people/h after an 8 h foot crossing); ambulance 1/(2·travel + 0.75 h).
- **Planner (greedy):** repeatedly select the need with the largest remaining × weight, then assign the free suitable unit with the largest contribution (ties: shorter travel, then id). Each assignment records its reason and up to three alternatives. The heuristic is deterministic and explainable, but **not a proven optimum**.
- **Baseline (uncoordinated):** each unit goes to the nearest affected settlement it can serve, ignoring coverage. Shelter seekers go to the nearest shelter by straight line, ignoring capacity and closures.
- **Dispatcher overrides** are applied after the planner and recomputed instantly.

## 5. Disaster Readiness Index

The equal-weight mean of shelter coverage, response coverage, route redundancy (an alternative ≤2× the best time, sharing ≤70% of its length), timeliness (first unit within 6 h) and road connectivity. It describes a simulated plan and is not an official rating.

## 6. Copilot

1. Detect intent (keyword rules: why-plan, what-if boats or delay, shelter, assumptions, bottlenecks, routes, data provenance, region risk, preparedness).
2. Build facts from engine outputs, recomputed server-side from validated URL parameters. What-if answers re-run the scenario.
3. Tag each fact as verified, estimate, assumption or advice, and add an uncertainty statement.
4. Optional: if `DASHSCOPE_API_KEY` is set, Qwen receives only the question and the facts under a strict system prompt (no new facts, no claims of dispatch or alerts, only 1122/15 as numbers, ignore injected instructions). Output is capped and rendered as plain text, separately from the facts.
5. Without a key, offline or on failure, the deterministic answer is returned. The browser can compute the same answer locally.

## 7. Validation status

| Claim | Status |
| --- | --- |
| Engines are deterministic and internally consistent | Verified by 62 unit/integration tests |
| Routing is correct on test graphs and plausible nationally (Islamabad–Lahore 270–450 km) | Verified by tests |
| Coordinated plan ≥ baseline coverage in every default scenario | Verified by tests |
| Risk index predicts losses | **Not validated** |
| Footprints match real inundation | **Not validated** (next: compare with 2022 satellite flood extents) |
| Unit rates match operations | **Not validated** (next: calibrate with PDMA / Rescue 1122 after-action data) |

Temporal and geographic leakage concerns do not apply, because no model is fitted to data.
