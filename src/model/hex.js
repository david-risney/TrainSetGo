// Axial hex coordinates (pointy-top) with 6 edge directions. DOM-free, pure logic.
// Edge indices 0..5 map to fixed axial direction vectors (redblobgames convention).

import { EDGE_COUNT } from "./constants.js";

// Edge index -> axial direction vector {q, r}.
export const EDGE_DIRECTIONS = Object.freeze([
  { q: 1, r: 0 }, // 0
  { q: 1, r: -1 }, // 1
  { q: 0, r: -1 }, // 2
  { q: -1, r: 0 }, // 3
  { q: -1, r: 1 }, // 4
  { q: 0, r: 1 }, // 5
]);

export function makeHex(q, r) {
  return { q, r };
}

export function hexKey(hex) {
  return `${hex.q},${hex.r}`;
}

export function hexEquals(a, b) {
  return a.q === b.q && a.r === b.r;
}

// Opposite edge: the edge index on the neighbor that faces back to this hex.
export function oppositeEdge(edge) {
  return (edge + 3) % EDGE_COUNT;
}

// Neighbor hex across a given edge index.
export function neighbor(hex, edge) {
  const d = EDGE_DIRECTIONS[edge];
  return { q: hex.q + d.q, r: hex.r + d.r };
}

// All 6 neighbors in edge order.
export function neighbors(hex) {
  return EDGE_DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

// Edge index from `from` to an adjacent `to`, or -1 if not adjacent.
export function edgeTo(from, to) {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  for (let e = 0; e < EDGE_COUNT; e++) {
    const d = EDGE_DIRECTIONS[e];
    if (d.q === dq && d.r === dr) return e;
  }
  return -1;
}

// Cube distance between two axial hexes.
export function hexDistance(a, b) {
  const aq = a.q;
  const ar = a.r;
  const as = -aq - ar;
  const bq = b.q;
  const br = b.r;
  const bs = -bq - br;
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(as - bs)) / 2;
}

// Rotate an edge index by n steps (clockwise), wrapping 0..5.
export function rotateEdge(edge, n) {
  return ((edge + n) % EDGE_COUNT + EDGE_COUNT) % EDGE_COUNT;
}
