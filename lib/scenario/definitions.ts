import type { ControlSpec, ScenarioDefinition, ScenarioParams } from './types';

/**
 * Scenario definitions. Every population, capacity and asset count here is a
 * SCENARIO ASSUMPTION chosen to be plausible in order of magnitude. Town
 * coordinates are approximate town centres; "synthetic" settlements are
 * representative clusters placed near real river centrelines to stand for
 * riverine (kacha) communities. None of this is observed data.
 */

const COMMON_DEFAULTS: Omit<ScenarioParams, 'boats' | 'teams' | 'ambulances'> = {
  riverRiseM: 3,
  rainfallMm: 250,
  slideSeverity: 0.6,
  shelterCapacityPct: 100,
  demandPct: 100,
  responseDelayH: 4,
  bridgeCloseM: 5,
  closures: [],
  disabledShelters: [],
  hour: 0,
  strategy: 'coordinated',
};

const resourceControls = (maxBoats: number, maxTeams: number, maxAmb: number): ControlSpec[] => [
  ...(maxBoats > 0 ? [{ key: 'boats' as const, label: 'Rescue boats', min: 0, max: maxBoats, step: 1, unit: '', help: 'Total boats across all depots (distributed by depot base share).' }] : []),
  { key: 'teams', label: 'Rescue teams', min: 0, max: maxTeams, step: 1, unit: '', help: 'Land/foot rescue teams assisting evacuation.' },
  { key: 'ambulances', label: 'Ambulances', min: 0, max: maxAmb, step: 1, unit: '', help: 'Road ambulances for medical transfers.' },
  { key: 'shelterCapacityPct', label: 'Shelter capacity', min: 25, max: 200, step: 5, unit: '%', help: 'Share of nominal shelter capacity that is actually available.' },
  { key: 'demandPct', label: 'Population demand', min: 50, max: 200, step: 5, unit: '%', help: 'Scales assumed population (uncertainty in who is present).' },
  { key: 'responseDelayH', label: 'Response delay', min: 0, max: 24, step: 1, unit: 'h', help: 'Hours from hazard onset until units start moving.' },
];

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'south-punjab-flood',
    title: 'Southern Punjab riverine flood — Muzaffargarh (Indus–Chenab doab)',
    shortTitle: 'Southern Punjab flood',
    region: 'Muzaffargarh district and surroundings, Punjab',
    summary:
      'A hypothetical high-flow event on the Indus and Chenab. Riverine (kacha) communities between the rivers are exposed first; bridges and embanked approaches close at higher levels.',
    hazardLabel: 'River level rise above bankfull',
    durationH: 72,
    peakH: 36,
    view: { center: [71.0, 29.9], zoom: 7.5 },
    bbox: [70.2, 28.9, 71.8, 30.9],
    hazard: { kind: 'riverine', rivers: ['Indus', 'Chenab'], baseKm: 0.5, kmPerMetre: 1.8 },
    settlements: [
      { id: 'mzg', name: 'Muzaffargarh city', coord: [71.193, 30.072], population: 220000, synthetic: false },
      { id: 'khangarh', name: 'Khangarh', coord: [71.161, 29.917], population: 35000, synthetic: false },
      { id: 'alipur', name: 'Alipur', coord: [70.912, 29.383], population: 60000, synthetic: false },
      { id: 'jatoi', name: 'Jatoi', coord: [70.857, 29.517], population: 50000, synthetic: false },
      { id: 'kotaddu', name: 'Kot Addu', coord: [70.966, 30.469], population: 120000, synthetic: false },
      { id: 'k1', name: 'Indus kacha cluster — north', coord: [70.85, 30.36], population: 18000, synthetic: true, note: 'Representative riverine community, ~3 km from the Indus centreline.' },
      { id: 'k2', name: 'Indus kacha cluster — central', coord: [70.88, 29.9], population: 22000, synthetic: true, note: 'Representative riverine community, ~3.5 km from the Indus centreline.' },
      { id: 'k3', name: 'Indus kacha cluster — south', coord: [70.69, 29.55], population: 16000, synthetic: true, note: 'Representative riverine community, ~4 km from the Indus centreline.' },
      { id: 'c1', name: 'Chenab bank cluster — Muzaffargarh', coord: [71.215, 30.05], population: 20000, synthetic: true, note: 'Representative community on the Chenab west bank.' },
      { id: 'c2', name: 'Chenab bank cluster — south', coord: [71.02, 29.6], population: 15000, synthetic: true, note: 'Representative community on the Chenab west bank.' },
      { id: 'p1', name: 'Panjnad confluence cluster', coord: [70.93, 29.3], population: 14000, synthetic: true, note: 'Representative community near the Chenab–Panjnad reach.' },
    ],
    shelters: [
      { id: 'sh-mzg', name: 'Muzaffargarh relief camp', coord: [71.17, 30.09], capacity: 25000 },
      { id: 'sh-thal', name: 'Northern high-ground camp', coord: [71.08, 30.3], capacity: 12000 },
      { id: 'sh-multan', name: 'Multan relief camp', coord: [71.47, 30.21], capacity: 40000 },
      { id: 'sh-kotaddu', name: 'Kot Addu relief camp', coord: [70.99, 30.47], capacity: 15000 },
      { id: 'sh-dgk', name: 'Dera Ghazi Khan relief camp', coord: [70.64, 30.05], capacity: 20000 },
      { id: 'sh-jatoi', name: 'Jatoi school camp', coord: [70.86, 29.52], capacity: 8000 },
      { id: 'sh-alipur', name: 'Alipur school camp', coord: [70.92, 29.39], capacity: 8000 },
    ],
    depots: [
      { id: 'dp-mzg', name: 'Muzaffargarh depot', coord: [71.18, 30.08], base: { boat: 10, team: 12, ambulance: 12 } },
      { id: 'dp-multan', name: 'Multan depot', coord: [71.46, 30.2], base: { boat: 8, team: 14, ambulance: 16 } },
      { id: 'dp-dgk', name: 'Dera Ghazi Khan depot', coord: [70.64, 30.06], base: { boat: 6, team: 8, ambulance: 8 } },
      { id: 'dp-kotaddu', name: 'Kot Addu depot', coord: [70.98, 30.46], base: { boat: 4, team: 6, ambulance: 6 } },
    ],
    closures: [
      { id: 'chenab-bridge', label: 'Chenab bridge, Muzaffargarh–Multan road', coord: [71.279, 30.065], radiusKm: 3 },
      { id: 'indus-bridge', label: 'Indus bridge (Ghazi Ghat), Muzaffargarh–DG Khan road', coord: [70.826, 30.082], radiusKm: 3 },
      { id: 'panjnad-crossing', label: 'Chenab crossing near Panjnad', coord: [71.01, 29.321], radiusKm: 3 },
    ],
    controls: [
      { key: 'riverRiseM', label: 'River level rise', min: 0, max: 6, step: 0.25, unit: 'm', help: 'Hypothetical rise above bankfull at peak. Drives the illustrative flood corridor.' },
      { key: 'bridgeCloseM', label: 'Bridges close at', min: 2, max: 7, step: 0.25, unit: 'm', help: 'Level at which bridges and their embanked approaches are assumed unsafe.' },
      ...resourceControls(60, 80, 80),
    ],
    defaults: { ...COMMON_DEFAULTS, hour: 36, riverRiseM: 3.5, responseDelayH: 6, boats: 20, teams: 32, ambulances: 30 },
    assumptions: [
      'Flood corridor half-width = 0.5 km + 1.8 km per metre of rise on each side of the Natural Earth river centreline (illustrative, not hydraulically modelled).',
      'Inundation depth proxy = rise × (1 − distance ÷ half-width); roads close where depth exceeds 1 m and settlements need boats where it exceeds 1 m.',
      'Bridges and roads within 12 km of a river crossing are embanked and close only at the “bridges close at” level.',
      'Hydrograph rises smoothly to peak at hour 36 and holds to hour 72.',
      'Evacuees are only sent to shelters reachable within 4 hours; others count as unsheltered.',
      'Populations are order-of-magnitude assumptions; kacha clusters are synthetic stand-ins for riverine communities.',
      '10% of exposed people need assisted evacuation, 30% seek public shelter, 0.4% become medical transfers.',
    ],
    assistShare: 0.1,
    shelterShare: 0.3,
    medicalShare: 0.004,
    isolationNeedShare: 0.05,
  },
  {
    id: 'twin-cities-urban-flood',
    title: 'Islamabad–Rawalpindi urban flooding — Lai Nullah',
    shortTitle: 'Twin Cities urban flood',
    region: 'Rawalpindi and Islamabad',
    summary:
      'A hypothetical extreme rainfall event over the Twin Cities, comparable in type to July 2001. Drainage capacity is exceeded and the Lai Nullah overflows into low-lying neighbourhoods.',
    hazardLabel: 'Event rainfall total',
    durationH: 24,
    peakH: 8,
    view: { center: [73.07, 33.63], zoom: 11 },
    bbox: [72.95, 33.5, 73.2, 33.75],
    hazard: {
      kind: 'pluvial',
      channel: [
        [73.045, 33.715],
        [73.055, 33.68],
        [73.065, 33.65],
        [73.06, 33.625],
        [73.06, 33.605],
        [73.07, 33.59],
        [73.09, 33.57],
        [73.12, 33.545],
      ],
      channelNote: 'Schematic Lai Nullah course drawn from approximate locality positions — for illustration only, not surveyed.',
      drainageCapacityMm: 60,
      baseKm: 0.1,
      kmPerMm: 0.004,
    },
    settlements: [
      { id: 'isb-g', name: 'Islamabad low-lying sectors (approx.)', coord: [73.058, 33.69], population: 30000, synthetic: true },
      { id: 'katarian', name: 'Katarian & Dhok Elahi Bux area (approx.)', coord: [73.067, 33.648], population: 60000, synthetic: true },
      { id: 'dhokhassu', name: 'Pirwadhai & Dhok Hassu area (approx.)', coord: [73.05, 33.625], population: 55000, synthetic: true },
      { id: 'gawalmandi', name: 'Gawalmandi & Kohati Bazaar area (approx.)', coord: [73.064, 33.603], population: 70000, synthetic: true },
      { id: 'dhokratta', name: 'Dhok Ratta area (approx.)', coord: [73.076, 33.614], population: 50000, synthetic: true },
      { id: 'lowerlai', name: 'Lower Lai Nullah neighbourhoods (approx.)', coord: [73.095, 33.575], population: 40000, synthetic: true },
    ],
    shelters: [
      { id: 'sh-r1', name: 'Shelter R-1 (higher ground, west)', coord: [73.03, 33.63], capacity: 9000 },
      { id: 'sh-r2', name: 'Shelter R-2 (higher ground, east)', coord: [73.1, 33.62], capacity: 8000 },
      { id: 'sh-i1', name: 'Shelter I-1 (Islamabad)', coord: [73.08, 33.71], capacity: 10000 },
      { id: 'sh-r3', name: 'Shelter R-3 (south)', coord: [73.06, 33.565], capacity: 7000 },
    ],
    depots: [
      { id: 'dp-rwp', name: 'Rawalpindi depot', coord: [73.045, 33.6], base: { boat: 5, team: 12, ambulance: 12 } },
      { id: 'dp-isb', name: 'Islamabad depot', coord: [73.085, 33.7], base: { boat: 4, team: 10, ambulance: 10 } },
      { id: 'dp-ckl', name: 'Chaklala depot', coord: [73.1, 33.59], base: { boat: 3, team: 8, ambulance: 8 } },
    ],
    closures: [
      { id: 'katarian-crossing', label: 'Nullah crossing near Katarian', coord: [73.065, 33.65], radiusKm: 0.6 },
      { id: 'gawalmandi-crossing', label: 'Nullah crossing near Gawalmandi', coord: [73.062, 33.603], radiusKm: 0.6 },
    ],
    controls: [
      { key: 'rainfallMm', label: 'Event rainfall', min: 0, max: 650, step: 10, unit: 'mm', help: 'Hypothetical total rainfall. July 2001 was about 620 mm in Islamabad.' },
      ...resourceControls(30, 60, 60),
    ],
    defaults: { ...COMMON_DEFAULTS, hour: 8, rainfallMm: 300, responseDelayH: 1, boats: 16, teams: 30, ambulances: 30 },
    assumptions: [
      'Drainage absorbs the first 60 mm; the overflow corridor half-width grows by 4 m per mm of excess rainfall (illustrative).',
      'The Lai Nullah course is schematic; neighbourhood clusters are approximate and synthetic.',
      'All trips are local (<15 km): distance = 1.35 × straight line at 25 km/h; crossing the flooded corridor adds a 2.2× detour.',
      'Rainfall peaks at hour 8; the event is evaluated over 24 hours.',
      'Boats are needed where the depth proxy (excess mm ÷ 150 × (1 − distance ÷ half-width)) exceeds 1 m.',
      '6% of exposed people need assisted evacuation (many shelter on upper floors), 20% seek public shelter, 0.4% become medical transfers.',
    ],
    assistShare: 0.06,
    shelterShare: 0.2,
    medicalShare: 0.004,
    isolationNeedShare: 0.05,
  },
  {
    id: 'kohistan-landslide',
    title: 'Northern Pakistan landslide — Karakoram Highway, Kohistan',
    shortTitle: 'KKH landslide',
    region: 'Upper and Lower Kohistan, Khyber Pakhtunkhwa; Diamer, Gilgit-Baltistan',
    summary:
      'Hypothetical monsoon-triggered landslides block the Karakoram Highway. Settlements between slides lose road access; the Babusar (N-15) route is the only alternative when open.',
    hazardLabel: 'Landslide severity',
    durationH: 48,
    peakH: 6,
    view: { center: [73.5, 35.2], zoom: 8.5 },
    bbox: [72.5, 34.2, 74.6, 36.1],
    hazard: {
      kind: 'landslide',
      slides: [
        { id: 's1', label: 'Slide between Pattan and Dasu', coord: [73.179, 35.225], minSeverity: 0.2, activatesAtH: 2 },
        { id: 's2', label: 'Slide north of Dasu', coord: [73.3, 35.46], minSeverity: 0.5, activatesAtH: 5 },
        { id: 's3', label: 'Slide near Besham', coord: [72.86, 34.99], minSeverity: 0.85, activatesAtH: 6 },
      ],
      baseRadiusKm: 1,
      kmPerSeverity: 2,
    },
    settlements: [
      { id: 'besham', name: 'Besham', coord: [72.873, 34.93], population: 30000, synthetic: false },
      { id: 'pattan', name: 'Pattan', coord: [73.03, 35.1], population: 20000, synthetic: false },
      { id: 'dasu', name: 'Dasu–Komila', coord: [73.29, 35.29], population: 25000, synthetic: false },
      { id: 'upper-kohistan', name: 'Upper Kohistan KKH villages', coord: [73.55, 35.52], population: 15000, synthetic: true, note: 'Representative cluster of roadside villages.' },
      { id: 'chilas', name: 'Chilas', coord: [74.1, 35.42], population: 40000, synthetic: false },
    ],
    shelters: [
      { id: 'sh-besham', name: 'Besham relief point', coord: [72.88, 34.92], capacity: 5000 },
      { id: 'sh-dasu', name: 'Dasu relief point', coord: [73.29, 35.3], capacity: 3000 },
      { id: 'sh-chilas', name: 'Chilas relief point', coord: [74.1, 35.42], capacity: 5000 },
    ],
    depots: [
      { id: 'dp-mansehra', name: 'Mansehra depot', coord: [73.197, 34.342], base: { boat: 0, team: 6, ambulance: 5 } },
      { id: 'dp-besham', name: 'Besham depot', coord: [72.873, 34.93], base: { boat: 0, team: 4, ambulance: 3 } },
      { id: 'dp-chilas', name: 'Chilas depot', coord: [74.1, 35.42], base: { boat: 0, team: 3, ambulance: 2 } },
    ],
    closures: [
      { id: 'babusar', label: 'Babusar Pass (N-15) — seasonal closure', coord: [74.0, 35.15], radiusKm: 4 },
    ],
    controls: [
      { key: 'slideSeverity', label: 'Landslide severity', min: 0, max: 1, step: 0.05, unit: '', help: 'Higher severity activates more slides and widens each blocked section.' },
      ...resourceControls(0, 40, 30),
    ],
    defaults: { ...COMMON_DEFAULTS, hour: 6, slideSeverity: 0.6, responseDelayH: 2, boats: 0, teams: 6, ambulances: 6 },
    assumptions: [
      'Slides activate when severity exceeds each slide’s threshold; blocked radius = 1 km + 2 km × severity.',
      'Settlements with no open road path to any depot are “isolated”; 5% of their population needs outside assistance.',
      'Rescue teams can cross a blocked section on foot with an 8-hour penalty and then assist 5 people per hour; ambulances cannot.',
      '0.2% of an isolated settlement’s population needs medical evacuation — by air or on foot, which this model does not schedule.',
      'Road clearance is not modelled within the 48-hour window.',
      'Populations are order-of-magnitude assumptions.',
    ],
    assistShare: 0.1,
    shelterShare: 0.3,
    medicalShare: 0.004,
    isolationNeedShare: 0.05,
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
export const DEFAULT_SCENARIO = SCENARIOS[0];
