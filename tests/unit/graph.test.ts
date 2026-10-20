import { describe, expect, it } from 'vitest';
import { alternativeRoutes, buildGraph, dijkstra, nearestNode, pathEdges, reachableFrom, route, type RawGraph } from '@/lib/geo/graph';
import { getRoadGraph } from '@/lib/geo/data';

// Diamond graph: 0 -> 1 -> 3 (short) and 0 -> 2 -> 3 (long)
const tiny: RawGraph = {
  meta: {},
  nodes: [[70, 30], [70.1, 30.05], [70.1, 29.9], [70.2, 30]],
  edges: [[0, 1, 10, 1], [1, 3, 10, 1], [0, 2, 20, 2], [2, 3, 20, 2]],
};

describe('road graph routing', () => {
  it('dijkstra finds the shortest path by travel time', () => {
    const g = buildGraph(tiny);
    const tree = dijkstra(g, 0);
    expect(pathEdges(g, tree, 3)).toEqual([0, 1]);
    expect(tree.hours[3]).toBeCloseTo(20 / 70, 6);
  });
  it('respects closed edges and reports unreachable nodes', () => {
    const g = buildGraph(tiny);
    expect(pathEdges(g, dijkstra(g, 0, new Set([1])), 3)).toEqual([2, 3]);
    const cut = dijkstra(g, 0, new Set([1, 3]));
    expect(pathEdges(g, cut, 3)).toBeNull();
    expect(reachableFrom(g, [0], new Set([1, 3]))[3]).toBe(0);
  });
  it('national graph: Islamabad → Lahore is routable with a plausible road distance', () => {
    const g = getRoadGraph();
    expect(g.nodes.length).toBeGreaterThan(4000);
    const r = route(g, [73.081, 33.689], [74.348, 31.562]);
    expect(r.feasible).toBe(true);
    expect(r.method).toBe('graph');
    expect(r.km).toBeGreaterThan(270);
    expect(r.km).toBeLessThan(450);
    expect(r.coords.length).toBeGreaterThan(5);
  });
  it('short trips are estimated, not routed', () => {
    const r = route(getRoadGraph(), [73.06, 33.6], [73.08, 33.62]);
    expect(r.method).toBe('estimated-local');
    expect(r.note).toMatch(/straight-line/);
  });
  it('alternatives are distinct and not faster than the first route', () => {
    const g = getRoadGraph();
    const alts = alternativeRoutes(g, [73.081, 33.689], [71.453, 30.202], undefined, 3);
    expect(alts.length).toBeGreaterThanOrEqual(2);
    for (const a of alts.slice(1)) expect(a.hours).toBeGreaterThanOrEqual(alts[0].hours - 1e-9);
    const shared = alts[1].edges.filter((e) => new Set(alts[0].edges).has(e)).length;
    expect(shared).toBeLessThan(alts[1].edges.length);
  });
  it('nearestNode snaps to the closest vertex', () => {
    const g = buildGraph(tiny);
    expect(nearestNode(g, [70.19, 30.01]).node).toBe(3);
  });
});
