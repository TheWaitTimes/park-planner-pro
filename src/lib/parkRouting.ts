// Walking-route engine for the Park Map tab.
// Path network, attraction and entrance coordinates come from OpenStreetMap
// (© OpenStreetMap contributors, ODbL) and are precompiled into parkMaps.json.

import rawMaps from "@/data/parkMaps.json";

export interface MapPoi {
  name: string;
  kind: string;
  node: number;
  lat: number;
  lon: number;
}

export interface ParkMapData {
  bbox: [number, number, number, number];
  nodes: [number, number][];
  /** [fromNode, toNode, meters, polyline] */
  edges: [number, number, number, [number, number][]][];
  pois: MapPoi[];
}

export const PARK_MAPS = rawMaps as unknown as Record<string, ParkMapData>;

export const PARK_MAP_NAMES = Object.keys(PARK_MAPS);

/** Comfortable theme-park walking pace in metres per minute (crowds included). */
export const WALK_METRES_PER_MINUTE = 67;

interface Adjacency {
  to: number;
  meters: number;
  geometry: [number, number][];
}

const adjacencyCache = new Map<string, Map<number, Adjacency[]>>();

function getAdjacency(park: string): Map<number, Adjacency[]> {
  const cached = adjacencyCache.get(park);
  if (cached) return cached;
  const data = PARK_MAPS[park];
  const adj = new Map<number, Adjacency[]>();
  const push = (from: number, entry: Adjacency) => {
    const list = adj.get(from);
    if (list) list.push(entry);
    else adj.set(from, [entry]);
  };
  for (const [a, b, meters, geometry] of data.edges) {
    push(a, { to: b, meters, geometry });
    push(b, { to: a, meters, geometry: [...geometry].reverse() });
  }
  adjacencyCache.set(park, adj);
  return adj;
}

export interface RouteResult {
  meters: number;
  minutes: number;
  /** Full polyline of the walk, in [lat, lon] pairs. */
  path: [number, number][];
}

/** Shortest walking path between two network nodes (Dijkstra over the path graph). */
export function findRoute(park: string, fromNode: number, toNode: number): RouteResult | null {
  if (fromNode === toNode) return { meters: 0, minutes: 0, path: [] };
  const adj = getAdjacency(park);
  const dist = new Map<number, number>([[fromNode, 0]]);
  const prev = new Map<number, { node: number; geometry: [number, number][] }>();
  const visited = new Set<number>();
  // Simple binary-heap-free queue: park graphs are ~1k nodes, so a sorted scan is fast enough.
  const queue: { node: number; d: number }[] = [{ node: fromNode, d: 0 }];

  while (queue.length) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].d < queue[bestIndex].d) bestIndex = i;
    const { node, d } = queue.splice(bestIndex, 1)[0];
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === toNode) break;
    for (const edge of adj.get(node) ?? []) {
      const next = d + edge.meters;
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        prev.set(edge.to, { node, geometry: edge.geometry });
        queue.push({ node: edge.to, d: next });
      }
    }
  }

  const total = dist.get(toNode);
  if (total === undefined) return null;

  const segments: [number, number][][] = [];
  let cursor = toNode;
  while (cursor !== fromNode) {
    const step = prev.get(cursor);
    if (!step) return null;
    segments.push(step.geometry);
    cursor = step.node;
  }
  segments.reverse();
  const path: [number, number][] = [];
  for (const segment of segments) {
    for (const point of segment) {
      const last = path[path.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) path.push(point);
    }
  }

  return {
    meters: Math.round(total),
    minutes: Math.max(1, Math.round(total / WALK_METRES_PER_MINUTE)),
    path,
  };
}

/** Projects lat/lon onto a fixed-size drawing surface, keeping real-world proportions. */
export function makeProjector(park: string, width: number, height: number, padding = 12) {
  const data = PARK_MAPS[park];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of data.nodes) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const midLat = (minLat + maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const spanX = (maxLon - minLon) * lonScale;
  const spanY = maxLat - minLat;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return (lat: number, lon: number): [number, number] => [
    offsetX + (lon - minLon) * lonScale * scale,
    offsetY + (maxLat - lat) * scale,
  ];
}
