// Track shape connectivity. Pure logic; maps shape+orientation(+switchState) to the
// pairs of hex edges a tile connects. Edge indices 0..5 (see hex.js). (FR-002, FR-007, FR-008)

import { TrackShape } from "./constants.js";
import { rotateEdge } from "./hex.js";

// Base connection definitions at orientation 0.
// - straight / curves: a single connected pair of edges.
// - crossing: two independent pairs that do NOT merge.
// - switch: a fixed inbound edge plus selectable outbound branch edges.
const BASE = {
  [TrackShape.STRAIGHT]: { pairs: [[0, 3]] },
  [TrackShape.SLIGHT_CURVE]: { pairs: [[0, 2]] },
  [TrackShape.SHARP_CURVE]: { pairs: [[0, 1]] },
  [TrackShape.CROSSING]: { pairs: [[0, 3], [1, 4]] },
  [TrackShape.SWITCH]: { inbound: 3, branches: [0, 1] },
};

export function isSwitch(shape) {
  return shape === TrackShape.SWITCH;
}

export function switchBranchCount(shape) {
  return isSwitch(shape) ? BASE[TrackShape.SWITCH].branches.length : 0;
}

// The connected pairs for a placement, after rotation and (for switches) branch selection.
// Returns an array of [edgeA, edgeB] pairs.
export function connectionPairs(shape, orientation = 0, switchState = 0) {
  const base = BASE[shape];
  if (!base) return [];
  if (isSwitch(shape)) {
    const inbound = rotateEdge(base.inbound, orientation);
    const branchEdge = rotateEdge(base.branches[switchState % base.branches.length], orientation);
    return [[inbound, branchEdge]];
  }
  return base.pairs.map(([a, b]) => [rotateEdge(a, orientation), rotateEdge(b, orientation)]);
}

// Unique sorted list of edges that the placement connects (for adjacency rendering/checks).
export function connectedEdges(shape, orientation = 0, switchState = 0) {
  const set = new Set();
  for (const [a, b] of connectionPairs(shape, orientation, switchState)) {
    set.add(a);
    set.add(b);
  }
  return [...set].sort((x, y) => x - y);
}

// Does this placement connect the given edge?
export function connectsEdge(shape, orientation, switchState, edge) {
  return connectionPairs(shape, orientation, switchState).some(
    ([a, b]) => a === edge || b === edge,
  );
}

// Given a train entering via `enterEdge`, the edge it exits through, or null if there is
// no connected continuation (end of track / switch set against the train). (FR-014)
export function exitEdge(shape, orientation, switchState, enterEdge) {
  for (const [a, b] of connectionPairs(shape, orientation, switchState)) {
    if (a === enterEdge) return b;
    if (b === enterEdge) return a;
  }
  return null;
}
