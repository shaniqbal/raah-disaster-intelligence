# Limitations

RAAH is a **public demonstration**. It is not an emergency service, not an official warning system, and not affiliated with NDMA, PDMA, PMD, Rescue 1122 or any government authority.

## Data
- Natural Earth geography is generalised. Local streets, smaller rivers (Kabul, Swat, Gilgit) and urban nullahs are missing; local waterways use analyst scores.
- Boundaries are Natural Earth de facto lines. They are not authoritative, and Jammu & Kashmir is disputed territory.
- Region coordinates marked "approximate" are town centres rounded to about 0.01°.
- City size, heat and terrain classes are analyst assumptions.
- Live data depends on USGS and Open-Meteo availability. Open-Meteo output is a model forecast, not an official warning.
- The historical event list is curated, not complete.

## Models
- The risk index is a relative screening tool and has not been validated against losses.
- Hazard footprints are illustrative corridors and circles, not hydraulic or geotechnical models.
- The Lai Nullah course in the urban scenario is schematic.
- Populations, shelters, depots and unit counts in scenarios are assumptions; some settlements are synthetic.
- Unit rates, demand shares and speeds are assumptions and have not been calibrated.
- Allocation is a greedy heuristic, not an optimiser.
- No casualty or lives-saved estimates are produced, because no validated model supports them.

## Product
- No authentication or roles. The dispatcher view is a single-user demo stored on the device.
- SOS reports stay on the device and reach no one.
- Urdu and Roman Urdu texts were written for this project and await review by native-speaking emergency professionals; English is authoritative.
- The API rate limit is in-memory per serverless instance (best effort).
- Lighthouse performance on throttled mobile is 62–79 (measured), because routing and simulation run on the main thread.
