import test from "node:test";
import assert from "node:assert/strict";
import {
  connectedEdges,
  connectionPairs,
  connectsEdge,
  exitEdge,
  switchBranchCount,
} from "../../src/model/track.js";
import { TrackShape } from "../../src/model/constants.js";

test("straight connects opposite edges 0 and 3", () => {
  assert.deepEqual(connectedEdges(TrackShape.STRAIGHT, 0), [0, 3]);
});

test("rotation shifts connected edges", () => {
  assert.deepEqual(connectedEdges(TrackShape.STRAIGHT, 1), [1, 4]);
  assert.deepEqual(connectedEdges(TrackShape.STRAIGHT, 3), [0, 3]);
});

test("slight curve connects edges two apart; sharp curve adjacent", () => {
  assert.deepEqual(connectedEdges(TrackShape.SLIGHT_CURVE, 0), [0, 2]);
  assert.deepEqual(connectedEdges(TrackShape.SHARP_CURVE, 0), [0, 1]);
});

test("crossing exposes two independent pairs that do not merge", () => {
  const pairs = connectionPairs(TrackShape.CROSSING, 0);
  assert.equal(pairs.length, 2);
  // entering edge 0 exits 3; entering 1 exits 4 — lines stay separate
  assert.equal(exitEdge(TrackShape.CROSSING, 0, 0, 0), 3);
  assert.equal(exitEdge(TrackShape.CROSSING, 0, 0, 1), 4);
});

test("exitEdge returns the partner of the entered edge", () => {
  assert.equal(exitEdge(TrackShape.STRAIGHT, 0, 0, 3), 0);
  assert.equal(exitEdge(TrackShape.STRAIGHT, 0, 0, 0), 3);
});

test("exitEdge returns null at end of track", () => {
  assert.equal(exitEdge(TrackShape.STRAIGHT, 0, 0, 1), null);
});

test("switch routes inbound to active branch; null on inactive branch", () => {
  assert.equal(switchBranchCount(TrackShape.SWITCH), 2);
  // switchState 0: inbound 3 <-> branch 0
  assert.equal(exitEdge(TrackShape.SWITCH, 0, 0, 3), 0);
  assert.equal(exitEdge(TrackShape.SWITCH, 0, 0, 1), null);
  // switchState 1: inbound 3 <-> branch 1
  assert.equal(exitEdge(TrackShape.SWITCH, 0, 1, 3), 1);
  assert.equal(exitEdge(TrackShape.SWITCH, 0, 1, 0), null);
});

test("connectsEdge reflects connected edges", () => {
  assert.ok(connectsEdge(TrackShape.STRAIGHT, 0, 0, 3));
  assert.ok(!connectsEdge(TrackShape.STRAIGHT, 0, 0, 2));
});
