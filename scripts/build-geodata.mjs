/**
 * Reproducible geodata pipeline.
 *
 * Input:  Natural Earth 1:10m GeoJSON (public domain) downloaded into
 *         NE_DIR (default: ./data-raw, git-ignored). Fetch with:
 *           https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/<layer>.geojson
 * Output: data/generated/geo-base.json   (country, neighbours, provinces, rivers)
 *         data/generated/road-graph.json (routable graph built from NE major roads)
 *
 * Nothing here is invented: geometry comes from Natural Earth, only clipped,
 * simplified and re-labelled with current official province names.
 */
import fs from 'node:fs';
import path from 'node:path';
import mapshaper from 'mapshaper';

const NE_DIR = process.env.NE_DIR || path.resolve('data-raw');
const OUT_DIR = path.resolve('data/generated');
const BBOX = [60.0, 23.3, 78.2, 37.4];

const layer = (name) => path.join(NE_DIR, `${name}.geojson`);
fs.mkdirSync(OUT_DIR, { recursive: true });

async function ms(cmd, input) {
  const out = await mapshaper.applyCommands(cmd, input);
  const key = Object.keys(out)[0];
  return JSON.parse(out[key].toString());
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
function roundGeom(g, d) {
  const r = (c) => (typeof c[0] === 'number' ? [round(c[0], d), round(c[1], d)] : c.map(r));
  return { ...g, coordinates: r(g.coordinates) };
}

// d3-geo uses spherical winding: exterior rings clockwise, holes counter-clockwise
// (when drawn north-up). Natural Earth / RFC 7946 use the opposite, so rewind.
function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}
function rewindPolygon(rings) {
  return rings.map((ring, i) => {
    const cw = ringArea(ring) < 0;
    return (i === 0) === cw ? ring : [...ring].reverse();
  });
}
function rewind(g) {
  if (g.type === 'Polygon') return { ...g, coordinates: rewindPolygon(g.coordinates) };
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(rewindPolygon) };
  return g;
}

const PROVINCE_NAMES = {
  'Punjab': 'Punjab',
  'Sind': 'Sindh',
  'Baluchistan': 'Balochistan',
  'K.P.': 'Khyber Pakhtunkhwa',
  'F.A.T.A.': 'Khyber Pakhtunkhwa', // merged into KP by the 25th Amendment (2018)
  'Northern Areas': 'Gilgit-Baltistan',
  'Azad Kashmir': 'Azad Jammu & Kashmir',
  'F.C.T.': 'Islamabad Capital Territory',
};

async function main() {
  const bbox = BBOX.join(',');

  const country = await ms(
    `-i in.json -filter "ADM0_A3==='PAK'" -simplify 8% keep-shapes -filter-fields NAME -o out.json format=geojson`,
    { 'in.json': fs.readFileSync(layer('ne_10m_admin_0_countries')) },
  );
  fs.writeFileSync('/tmp/raah-pak.json', JSON.stringify(country));

  const neighbours = await ms(
    `-i in.json -filter "['IND','AFG','IRN','CHN','KAS','TJK'].includes(ADM0_A3)" -clip bbox=${bbox} -simplify 4% keep-shapes -filter-fields NAME,ADM0_A3 -o out.json format=geojson`,
    { 'in.json': fs.readFileSync(layer('ne_10m_admin_0_countries')) },
  );

  const provincesRaw = JSON.parse(fs.readFileSync(layer('ne_10m_admin_1_states_provinces')));
  provincesRaw.features = provincesRaw.features
    .filter((f) => f.properties.adm0_a3 === 'PAK')
    .map((f) => ({ ...f, properties: { name: PROVINCE_NAMES[f.properties.name] ?? f.properties.name } }));
  const provinces = await ms(
    `-i in.json -dissolve fields=name -simplify 8% keep-shapes -o out.json format=geojson`,
    { 'in.json': JSON.stringify(provincesRaw) },
  );

  const rivers = await ms(
    `-i in.json -filter "['Indus','Chenab','Jhelum','Ravi','Sutlej','Beas'].includes(name)" -clip bbox=${bbox} -dissolve fields=name -simplify 25% -o out.json format=geojson`,
    { 'in.json': fs.readFileSync(layer('ne_10m_rivers_lake_centerlines')) },
  );

  const roads = await ms(
    `-i in.json -clip /tmp/raah-pak.json -filter-fields type,name,length_km -o out.json format=geojson`,
    { 'in.json': fs.readFileSync(layer('ne_10m_roads')), '/tmp/raah-pak.json': fs.readFileSync('/tmp/raah-pak.json') },
  );

  const base = {
    meta: {
      source: 'Natural Earth 1:10m cultural and physical vectors (public domain), naturalearthdata.com',
      processing: 'Clipped, simplified (mapshaper) and province names updated to current official names. Boundaries are Natural Earth de facto lines and are not authoritative.',
      generatedBy: 'scripts/build-geodata.mjs',
    },
    country: country.features.map((f) => ({ ...f, geometry: rewind(roundGeom(f.geometry, 3)) })),
    neighbours: neighbours.features.map((f) => ({ ...f, geometry: rewind(roundGeom(f.geometry, 2)) })),
    provinces: provinces.features.map((f) => ({ ...f, geometry: rewind(roundGeom(f.geometry, 3)) })),
    rivers: rivers.features.map((f) => ({ ...f, geometry: roundGeom(f.geometry, 3) })),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'geo-base.json'), JSON.stringify(base));

  // ---------- Road graph ----------
  // Nodes are road vertices snapped to a ~110 m grid (3 decimal places).
  // Line endpoints that sit within SNAP_KM of another node are joined, because
  // Natural Earth roads are digitised independently and do not always share a
  // vertex at junctions. Edge weight is great-circle length in km.
  const SNAP_KM = 2.5;
  const key = (c) => `${round(c[0], 3)},${round(c[1], 3)}`;
  const nodes = new Map();
  const coords = [];
  const nodeId = (c) => {
    const k = key(c);
    if (!nodes.has(k)) { nodes.set(k, coords.length); coords.push([round(c[0], 3), round(c[1], 3)]); }
    return nodes.get(k);
  };
  const hav = (a, b) => {
    const R = 6371, t = Math.PI / 180;
    const dLat = (b[1] - a[1]) * t, dLon = (b[0] - a[0]) * t;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  const edges = new Map();
  const endpoints = new Set();
  const cls = (type) => (type === 'Major Highway' ? 1 : 2);
  for (const f of roads.features) {
    if (!f.geometry) continue;
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of lines) {
      if (line.length < 2) continue;
      let prev = nodeId(line[0]);
      endpoints.add(prev);
      for (let i = 1; i < line.length; i++) {
        const cur = nodeId(line[i]);
        if (cur !== prev) {
          const k = prev < cur ? `${prev}-${cur}` : `${cur}-${prev}`;
          if (!edges.has(k)) edges.set(k, [Math.min(prev, cur), Math.max(prev, cur), round(hav(coords[prev], coords[cur]), 3), cls(f.properties.type)]);
        }
        prev = cur;
      }
      endpoints.add(prev);
    }
  }
  let joins = 0;
  for (const e of endpoints) {
    let best = -1, bestD = Infinity;
    for (let j = 0; j < coords.length; j++) {
      if (j === e) continue;
      const d = hav(coords[e], coords[j]);
      if (d < bestD && d > 0) { bestD = d; best = j; }
    }
    if (best >= 0 && bestD <= SNAP_KM) {
      const k = e < best ? `${e}-${best}` : `${best}-${e}`;
      if (!edges.has(k)) { edges.set(k, [Math.min(e, best), Math.max(e, best), round(bestD, 3), 2]); joins++; }
    }
  }
  // Keep only the largest connected component so every routed pair is reachable in the base network.
  const adj = coords.map(() => []);
  for (const [a, b] of edges.values()) { adj[a].push(b); adj[b].push(a); }
  const comp = new Array(coords.length).fill(-1);
  const sizes = [];
  for (let s = 0; s < coords.length; s++) {
    if (comp[s] !== -1) continue;
    const id = sizes.length; let n = 0; const stack = [s]; comp[s] = id;
    while (stack.length) { const u = stack.pop(); n++; for (const v of adj[u]) if (comp[v] === -1) { comp[v] = id; stack.push(v); } }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const remap = new Map();
  const outNodes = [];
  coords.forEach((c, i) => { if (comp[i] === main) { remap.set(i, outNodes.length); outNodes.push(c); } });
  const outEdges = [...edges.values()].filter(([a]) => comp[a] === main).map(([a, b, km, c]) => [remap.get(a), remap.get(b), km, c]);
  const graph = {
    meta: {
      source: 'Natural Earth 1:10m roads (public domain) clipped to Pakistan',
      method: `Vertices snapped to 0.001°; line endpoints joined to the nearest vertex within ${SNAP_KM} km; largest connected component kept.`,
      caveat: 'Major roads only, generalised geometry. Suitable for demonstrating routing logic, not for navigation.',
      components: sizes.length, keptNodes: outNodes.length, droppedNodes: coords.length - outNodes.length, endpointJoins: joins,
    },
    nodes: outNodes,
    edges: outEdges,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'road-graph.json'), JSON.stringify(graph));
  console.log('graph', graph.meta, 'edges', outEdges.length);
  for (const f of ['geo-base.json', 'road-graph.json']) console.log(f, (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0), 'KB');
}

main().catch((e) => { console.error(e); process.exit(1); });
