'use client';

/**
 * Offline-first vector map of Pakistan. Geometry is bundled (Natural Earth,
 * public domain) so the map renders with no network and no tile server.
 * d3-geo projects, d3-zoom handles pan/zoom/pinch; React renders SVG.
 *
 * Overlays receive a `MapApi` to project coordinates. Geometry overlays draw in
 * map space (inside the zoom transform); markers/labels draw in screen space so
 * they keep a constant size.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { Minus, Plus, LocateFixed } from 'lucide-react';
import { GEO_BASE, getRoadGraph } from '@/lib/geo/data';
import type { LonLat } from '@/lib/geo/geometry';
import { cx } from '@/components/ui/primitives';

export interface MapView {
  center: LonLat;
  /** web-map style zoom; Pakistan fits at ~5.2 */
  zoom: number;
}

export interface MapApi {
  project: (p: LonLat) => [number, number];
  /** screen-space position after the zoom transform */
  toScreen: (p: LonLat) => [number, number];
  path: (geometry: unknown) => string;
  /** pixels per km in map space (multiply by transform k for screen) */
  pxPerKm: (at: LonLat) => number;
  k: number;
  width: number;
  height: number;
}

const MapCtx = createContext<MapApi | null>(null);
export const useMap = () => {
  const ctx = useContext(MapCtx);
  if (!ctx) throw new Error('useMap must be used inside <PakMap>');
  return ctx;
};

const BASE_ZOOM = 5.2;
/** Small territories only get a label once zoomed in enough to avoid overlaps. */
const PROVINCE_LABEL_MIN_K: Record<string, number> = { 'Islamabad Capital Territory': 9, 'Azad Jammu & Kashmir': 2.2 };
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface PakMapLayers {
  provinces?: boolean;
  rivers?: boolean;
  roads?: boolean;
  labels?: boolean;
}

export function PakMap({
  view,
  layers = { provinces: true, rivers: true, roads: false, labels: true },
  overlay,
  screenOverlay,
  className,
  ariaLabel = 'Map of Pakistan',
  closedEdges,
  minHeight = 320,
  controls = true,
}: {
  view?: MapView;
  layers?: PakMapLayers;
  overlay?: ReactNode;
  screenOverlay?: ReactNode;
  className?: string;
  ariaLabel?: string;
  closedEdges?: number[];
  minHeight?: number;
  controls?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const projection: GeoProjection = useMemo(
    () => geoMercator().fitExtent([[12, 12], [size.width - 12, size.height - 12]], { type: 'FeatureCollection', features: GEO_BASE.country } as never),
    [size.width, size.height],
  );
  const path = useMemo(() => geoPath(projection), [projection]);

  // Static base layers are memoised: they only change with size.
  const base = useMemo(() => {
    const p = (g: unknown) => path(g as never) ?? '';
    return {
      neighbours: GEO_BASE.neighbours.map((f) => ({ id: f.properties.ADM0_A3, d: p(f) })),
      country: GEO_BASE.country.map((f) => p(f)).join(' '),
      provinces: GEO_BASE.provinces.map((f) => ({ name: f.properties.name, d: p(f), c: path.centroid(f as never) })),
      rivers: GEO_BASE.rivers.map((f) => ({ name: f.properties.name, d: p(f) })),
    };
  }, [path]);

  const roads = useMemo(() => {
    if (!layers.roads) return null;
    const g = getRoadGraph();
    let major = '';
    let minor = '';
    for (const e of g.edges) {
      const a = projection(g.nodes[e.a])!;
      const b = projection(g.nodes[e.b])!;
      const seg = `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      if (e.cls === 1) major += seg;
      else minor += seg;
    }
    return { major, minor };
  }, [layers.roads, projection]);

  const closedPath = useMemo(() => {
    if (!closedEdges?.length) return '';
    const g = getRoadGraph();
    return closedEdges
      .map((e) => {
        const a = projection(g.nodes[g.edges[e].a])!;
        const b = projection(g.nodes[g.edges[e].b])!;
        return `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      })
      .join('');
  }, [closedEdges, projection]);

  // ---- zoom behaviour ----
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 120])
      .on('zoom', (ev) => setT(ev.transform));
    zoomRef.current = z;
    select(svg).call(z).on('dblclick.zoom', null);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  const transformFor = useCallback(
    (v: MapView) => {
      const k = Math.pow(2, v.zoom - BASE_ZOOM);
      const [x, y] = projection(v.center)!;
      return zoomIdentity.translate(size.width / 2 - x * k, size.height / 2 - y * k).scale(k);
    },
    [projection, size.width, size.height],
  );

  const animateTo = useCallback(
    (target: ZoomTransform) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      if (!svg || !z) return;
      const sel = select(svg);
      if (prefersReducedMotion()) {
        z.transform(sel, target);
        return;
      }
      const from = { ...t };
      const start = performance.now();
      const dur = 900;
      let raf = 0;
      const step = (now: number) => {
        const u = Math.min(1, (now - start) / dur);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        // interpolate scale geometrically for a smooth zoom
        const k = from.k * Math.pow(target.k / from.k, e);
        const x = from.x + (target.x - from.x) * e;
        const y = from.y + (target.y - from.y) * e;
        z.transform(sel, zoomIdentity.translate(x, y).scale(k));
        if (u < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t.k, t.x, t.y],
  );

  const viewKey = view ? `${view.center.join(',')}@${view.zoom}` : 'none';
  const sizeKey = `${size.width}x${size.height}`;
  const placed = useRef(false);
  const prevView = useRef(viewKey);
  useEffect(() => {
    if (!view) return;
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const target = transformFor(view);
    // First placement and container resizes jump; view changes animate.
    if (!placed.current || prevView.current === viewKey) {
      zoomRef.current.transform(select(svg), target);
      placed.current = true;
    } else {
      animateTo(target);
    }
    prevView.current = viewKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, sizeKey]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) zoomRef.current.scaleBy(select(svg), factor);
  };
  const reset = () => animateTo(view ? transformFor(view) : zoomIdentity);

  const api: MapApi = useMemo(() => {
    const kmRef = (at: LonLat) => {
      const a = projection(at)!;
      const b = projection([at[0], at[1] + 0.1])!;
      return Math.abs(b[1] - a[1]) / 11.0574;
    };
    return {
      project: (p) => projection(p)! as [number, number],
      toScreen: (p) => t.apply(projection(p)! as [number, number]) as [number, number],
      path: (g) => path(g as never) ?? '',
      pxPerKm: kmRef,
      k: t.k,
      width: size.width,
      height: size.height,
    };
  }, [projection, path, t, size.width, size.height]);

  const showProvinceLabels = layers.labels && t.k < 3.5 && size.width > 420;

  return (
    <div ref={wrapRef} className={cx('relative h-full w-full overflow-hidden rounded-xl border border-line bg-[var(--map-neighbour)]', className)} style={{ minHeight }}>
      <svg ref={svgRef} width={size.width} height={size.height} className="map-svg block cursor-grab active:cursor-grabbing" role="img" aria-label={ariaLabel}>
        <defs>
          <pattern id="raah-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--critical)" strokeWidth="1.2" strokeOpacity="0.55" />
          </pattern>
          <radialGradient id="raah-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <MapCtx.Provider value={api}>
          <g transform={t.toString()}>
            <rect x={-5000} y={-5000} width={12000} height={12000} fill="var(--map-neighbour)" />
            {base.neighbours.map((n) => (
              <path key={n.id} d={n.d} fill="var(--bg-2)" stroke="var(--border)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={base.country} fill="var(--map-land)" stroke="var(--map-border)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            {layers.provinces &&
              base.provinces.map((p) => <path key={p.name} d={p.d} fill="var(--map-land)" stroke="var(--map-border)" strokeOpacity={0.7} strokeWidth={0.7} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />)}
            {roads && (
              <>
                <path d={roads.minor} fill="none" stroke="var(--map-road)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                <path d={roads.major} fill="none" stroke="var(--map-road-major)" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
              </>
            )}
            {layers.rivers && base.rivers.map((r) => <path key={r.name} d={r.d} fill="none" stroke="var(--map-river)" strokeOpacity={0.85} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />)}
            {closedPath && <path d={closedPath} fill="none" stroke="var(--critical)" strokeWidth={2.6} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
            {overlay}
          </g>
          {showProvinceLabels && (
            <g pointerEvents="none">
              {base.provinces.map((p) => {
                if (!Number.isFinite(p.c[0])) return null;
                if ((PROVINCE_LABEL_MIN_K[p.name] ?? 0) > t.k) return null;
                const [x, y] = t.apply(p.c as [number, number]);
                return (
                  <text key={p.name} x={x} y={y} textAnchor="middle" className="fill-[var(--muted)] text-[10px] font-semibold uppercase tracking-[0.14em]" opacity={0.75}>
                    {p.name}
                  </text>
                );
              })}
            </g>
          )}
          {screenOverlay}
        </MapCtx.Provider>
      </svg>
      {controls && (
        <div className="absolute right-2 top-2 flex flex-col gap-1 no-print">
          <MapButton label="Zoom in" onClick={() => zoomBy(1.6)}>
            <Plus className="size-4" />
          </MapButton>
          <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.6)}>
            <Minus className="size-4" />
          </MapButton>
          <MapButton label="Reset view" onClick={reset}>
            <LocateFixed className="size-4" />
          </MapButton>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-1 left-2 right-2 truncate text-[10px] text-muted">
        Map data: Natural Earth (public domain). Boundaries are de facto and not authoritative; Jammu &amp; Kashmir is disputed territory.
      </p>
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex size-8 items-center justify-center rounded-md border border-line-strong bg-surface/90 text-ink-2 backdrop-blur hover:text-ink">
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ overlay helpers

/** Screen-space marker (button) that stays crisp at every zoom. */
export function Marker({ at, r = 6, color, label, text, onSelect, selected, pulse, shape = 'circle', showLabel, children }: { at: LonLat; r?: number; color: string; label: string; /** short visible label (defaults to label) */ text?: string; onSelect?: () => void; selected?: boolean; pulse?: boolean; shape?: 'circle' | 'square' | 'diamond' | 'triangle'; showLabel?: boolean; children?: ReactNode }) {
  const map = useMap();
  const [x, y] = map.toScreen(at);
  if (x < -40 || y < -40 || x > map.width + 40 || y > map.height + 40) return null;
  const common = { fill: color, stroke: selected ? 'var(--text)' : 'var(--bg)', strokeWidth: selected ? 2.5 : 1.5 };
  const shapeEl =
    shape === 'square' ? (
      <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={2} {...common} />
    ) : shape === 'diamond' ? (
      <rect x={-r * 0.85} y={-r * 0.85} width={1.7 * r} height={1.7 * r} transform="rotate(45)" {...common} />
    ) : shape === 'triangle' ? (
      <path d={`M0,${-r * 1.2}L${r * 1.1},${r * 0.8}L${-r * 1.1},${r * 0.8}Z`} {...common} />
    ) : (
      <circle r={r} {...common} />
    );
  return (
    <g
      transform={`translate(${x},${y})`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={onSelect ? 'cursor-pointer focus:outline-none' : undefined}
    >
      <title>{label}</title>
      {pulse && <circle r={r * 1.6} fill={color} opacity={0.5} className="pulse-ring" />}
      {shapeEl}
      {children}
      {showLabel && (
        <text x={r + 4} y={4} className="pointer-events-none fill-[var(--text)] text-[11px] font-medium" style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 }}>
          {text ?? label}
        </text>
      )}
    </g>
  );
}

/** A line or corridor drawn in map space. `widthKm` turns it into an illustrative buffer. */
export function GeoLine({ coords, color, widthPx = 2, widthKm, dash, opacity = 1, lines }: { coords?: LonLat[]; lines?: LonLat[][]; color: string; widthPx?: number; widthKm?: number; dash?: string; opacity?: number }) {
  const map = useMap();
  const all = lines ?? (coords ? [coords] : []);
  const d = all
    .map((l) =>
      l
        .map((p, i) => {
          const [x, y] = map.project(p);
          return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(''),
    )
    .join('');
  if (!d) return null;
  if (widthKm !== undefined) {
    const ref = all[0]?.[0];
    const w = ref ? 2 * widthKm * map.pxPerKm(ref) : 0;
    return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
  }
  return <path d={d} fill="none" stroke={color} strokeWidth={widthPx} strokeDasharray={dash} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
}

/** Circle with a radius in km, drawn in map space. */
export function GeoCircle({ at, radiusKm, fill, stroke, opacity = 1 }: { at: LonLat; radiusKm: number; fill: string; stroke?: string; opacity?: number }) {
  const map = useMap();
  const [x, y] = map.project(at);
  return <circle cx={x} cy={y} r={radiusKm * map.pxPerKm(at)} fill={fill} stroke={stroke} vectorEffect="non-scaling-stroke" opacity={opacity} />;
}

export function MapLegend({ items, title = 'Legend', className, defaultOpen = true }: { items: { label: string; color: string; shape?: 'dot' | 'line' | 'dash' | 'band' | 'square'; mode?: ReactNode }[]; title?: string; className?: string; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className={cx('group rounded-lg border border-line bg-surface/90 p-2.5 text-[11px] backdrop-blur', className)}>
      <summary className="cursor-pointer list-none font-semibold uppercase tracking-wider text-muted group-open:mb-1.5">
        {title} <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-ink-2">
            <span aria-hidden className="inline-flex w-5 justify-center">
              {it.shape === 'line' ? (
                <span className="h-0.5 w-5 rounded" style={{ background: it.color }} />
              ) : it.shape === 'dash' ? (
                <span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
              ) : it.shape === 'band' ? (
                <span className="h-2.5 w-5 rounded-sm" style={{ background: it.color }} />
              ) : it.shape === 'square' ? (
                <span className="size-2.5 rounded-sm" style={{ background: it.color }} />
              ) : (
                <span className="size-2.5 rounded-full" style={{ background: it.color }} />
              )}
            </span>
            <span className="flex-1">{it.label}</span>
            {it.mode}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Collision-aware labels: placed greedily by priority (right of the point,
 * then left); labels that would overlap an already placed one are skipped.
 */
export function MapLabels({ items }: { items: { id: string; at: LonLat; text: string; priority: number; r?: number; tone?: 'default' | 'muted' }[] }) {
  const map = useMap();
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out: { id: string; x: number; y: number; anchor: 'start' | 'end'; text: string; tone?: string }[] = [];
  const sorted = [...items].sort((a, b) => b.priority - a.priority);
  for (const it of sorted) {
    const [x, y] = map.toScreen(it.at);
    if (x < 0 || y < 0 || x > map.width || y > map.height) continue;
    const w = it.text.length * 6.3 + 6;
    const r = (it.r ?? 6) + 4;
    const tries: { x0: number; anchor: 'start' | 'end'; tx: number }[] = [
      { x0: x + r, anchor: 'start', tx: x + r },
      { x0: x - r - w, anchor: 'end', tx: x - r },
    ];
    for (const tr of tries) {
      const box = { x0: tr.x0, y0: y - 9, x1: tr.x0 + w, y1: y + 6 };
      if (box.x1 > map.width - 4 || box.x0 < 4) continue;
      if (placed.some((p) => !(box.x1 < p.x0 || box.x0 > p.x1 || box.y1 < p.y0 || box.y0 > p.y1))) continue;
      placed.push(box);
      out.push({ id: it.id, x: tr.tx, y: y + 4, anchor: tr.anchor, text: it.text, tone: it.tone });
      break;
    }
  }
  return (
    <g pointerEvents="none">
      {out.map((l) => (
        <text key={l.id} x={l.x} y={l.y} textAnchor={l.anchor} className={l.tone === 'muted' ? 'fill-[var(--text-2)] text-[10.5px]' : 'fill-[var(--text)] text-[11px] font-medium'} style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3, strokeLinejoin: 'round' }}>
          {l.text}
        </text>
      ))}
    </g>
  );
}
