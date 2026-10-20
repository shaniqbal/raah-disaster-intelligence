# Data Sources

RAAH uses only sources whose availability and licence were checked. Every value in the UI carries a mode: **LIVE**, **CACHED LIVE**, **HISTORICAL**, **ESTIMATED**, **ASSUMPTION**, **SIMULATION** or **UNAVAILABLE**.

## Connected sources

### Natural Earth 1:10m vectors — HISTORICAL
- **Provider:** Natural Earth (naturalearthdata.com), via `github.com/nvkelso/natural-earth-vector` (v5.2.0-pre)
- **Datasets:** `ne_10m_admin_0_countries`, `ne_10m_admin_1_states_provinces`, `ne_10m_rivers_lake_centerlines`, `ne_10m_roads`, `ne_10m_populated_places`
- **Licence:** public domain
- **Processing:** `scripts/build-geodata.mjs`. It clips to Pakistan, simplifies with mapshaper, renames provinces to current official names (and merges FATA into Khyber Pakhtunkhwa per the 25th Amendment), rewinds rings for d3-geo, and builds the road graph. The graph snaps vertices to 0.001°, joins line ends within 2.5 km and keeps the largest component, giving 4,251 nodes and 4,307 edges.
- **Coverage / limitations:** generalised; major roads only; the Kabul, Swat and Gilgit rivers and urban nullahs are missing; boundaries are de facto and not authoritative.
- **Cache policy:** bundled into the app (works offline).
- **Rebuild:** download the five GeoJSON files into `data-raw/` (git-ignored), then `npm run data:build`.

### USGS FDSN Event Web Service — LIVE
- **Endpoint:** `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=<now−30d>&minmagnitude=4&minlatitude=23.5&maxlatitude=37.2&minlongitude=60.5&maxlongitude=77.9&orderby=time`
- **Licence:** public domain (U.S. Government)
- **Coverage:** M≥4 events in a bounding box that includes parts of neighbouring countries
- **Update frequency:** minutes
- **Retrieval:** browser-side on app load, 9 s timeout, zod validation (malformed features dropped)
- **Error behaviour:** marked UNAVAILABLE. If a previous real response exists on the device, it is shown as CACHED LIVE with its original timestamp.

### Open-Meteo Forecast API — LIVE
- **Endpoint:** `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&daily=precipitation_sum,temperature_2m_max&forecast_days=3&timezone=Asia/Karachi` (all 18 regions in one call)
- **Licence:** data CC BY 4.0; free API for non-commercial use (check the terms before commercial use)
- **Coverage:** 3-day forecast at each focus-region point
- **Limitations:** numerical model output; not observations and not an official PMD forecast or warning
- **Error behaviour:** marked UNAVAILABLE. Risk scores drop the live factor and re-normalise the remaining weights.

### Curated historical events — HISTORICAL
13 events (1935–2022). Each has a date, a representative coordinate with an explanatory note, a summary, conservatively quoted impacts and source links. Figures checked during development:
- 2022 floods: NDMA cumulative figures exceed 1,700 deaths and 33 million affected; the PDNA estimated damages above US$14.9 bn and losses of about US$15.2 bn.
- 2005 Kashmir earthquake: USGS epicentre 34.493°N 73.629°E (as cited by the IIT Kanpur reconnaissance report).
- 2013 Awaran earthquake: 26.971°N 65.520°E per ADRC citing USGS (verify against USGS before operational use).
- 2001 Islamabad rainfall: about 620 mm in roughly 8–10 hours; reported death toll 61–81 across sources.

### Emergency numbers — HISTORICAL (verified facts)
Rescue 1122, Police 15, Fire 16, Edhi 115, Motorway Police 130. Each has an official source link. Verification date 2026-02-01, carried over from the original app dataset.

## Analyst assumptions — ASSUMPTION
City size class, climatological heat class, terrain class and local-waterway proximity scores for 18 regions (`lib/data/regions.ts`). Each is shown with its rationale and is intended to be replaced by official datasets: census-based gridded population, PMD climate normals, a DEM-derived slope model and an OSM/national hydrography layer.

## Scenario data — SIMULATION
Populations, shelters, depots, unit counts and hazard parameters in `lib/scenario/definitions.ts`. Town coordinates are approximate town centres. "Synthetic" settlements are representative riverine clusters placed near real river centrelines.

## Evaluated but not integrated
| Source | Reason |
| --- | --- |
| Pakistan Meteorological Department | No documented public JSON API was verified. |
| NDMA / PDMAs | Reports and advisories are published as documents; integration needs an official data-sharing arrangement. |
| Health facilities / shelter registry | No verified, licensed national dataset was available; scenario shelters are illustrative. |
| NASA / satellite flood extents | Valuable for validating footprints (roadmap). Not integrated because of data volume and processing scope. |
