import { geoBounds, geoContains } from 'd3-geo';
import type { ExtendedFeature } from 'd3-geo';
import { feature } from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';

export const MAP_W = 1000;
export const MAP_H = 500;

export interface ParticleField {
  points: Float32Array; // x,y pairs in MAP space
  edges: Uint32Array; // pairs of point indices
  count: number;
}

let cache: ParticleField | null = null;

export function project(lat: number, lng: number): [number, number] {
  return [((lng + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Poly = { f: ExtendedFeature; b: [[number, number], [number, number]] };

export function getParticleField(): ParticleField {
  if (cache) return cache;
  const topo = landTopo as unknown as Parameters<typeof feature>[0];
  const objects = (topo as unknown as { objects: Record<string, Parameters<typeof feature>[1]> }).objects;
  const land = feature(topo, objects.land) as unknown as { type: string; features?: ExtendedFeature[]; geometry?: { type: string; coordinates: number[][][][] } };
  const feats: ExtendedFeature[] = land.features ?? [land as unknown as ExtendedFeature];
  const polys: Poly[] = [];
  for (const f of feats) {
    const g = f.geometry as unknown as { type: string; coordinates: number[][][][] | number[][][] };
    const list = g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]];
    for (const coords of list) {
      const pf = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coords } } as unknown as ExtendedFeature;
      polys.push({ f: pf, b: geoBounds(pf) as [[number, number], [number, number]] });
    }
  }
  const step = 1.45;
  const pts: number[] = [];
  const grid = new Map<string, number>();
  let row = 0;
  for (let lat = 80; lat >= -56; lat -= step, row++) {
    const off = row % 2 ? step / 2 : 0;
    let col = 0;
    for (let lng = -180 + off; lng < 180; lng += step, col++) {
      let hit = false;
      for (const p of polys) {
        const [[x0, y0], [x1, y1]] = p.b;
        if (lat < y0 || lat > y1) continue;
        if (x0 <= x1 ? lng < x0 || lng > x1 : lng < x0 && lng > x1) continue;
        if (geoContains(p.f, [lng, lat])) { hit = true; break; }
      }
      if (hit) {
        const [x, y] = project(lat, lng);
        grid.set(`${row}:${col}`, pts.length / 2);
        pts.push(x, y);
      }
    }
  }
  const r = rng(1729);
  const edges: number[] = [];
  grid.forEach((idx, key) => {
    const [ro, co] = key.split(':').map(Number);
    const right = grid.get(`${ro}:${co + 1}`);
    if (right !== undefined && r() < 0.32) edges.push(idx, right);
    const down = grid.get(`${ro + 1}:${co + (ro % 2 ? 1 : 0)}`);
    if (down !== undefined && r() < 0.22) edges.push(idx, down);
    const far = grid.get(`${ro + 2}:${co + 1}`);
    if (far !== undefined && r() < 0.05) edges.push(idx, far);
  });
  cache = { points: new Float32Array(pts), edges: new Uint32Array(edges), count: pts.length / 2 };
  return cache;
}
