import test from "node:test";
import assert from "node:assert/strict";
import { GameModel } from "../../src/model/simulation.js";

function straight(q, r) {
  return { q, r, terrain: "grass", lock: "editable", track: { shape: "straight", orientation: 0, switchState: null } };
}

// Odd number of middle tiles -> two trains meet on the SAME center tile.
function headOnSameTile() {
  return {
    id: "collide-same",
    name: "Head On",
    seed: 1,
    grid: [
      { q: -2, r: 0, terrain: "station", lock: "locked", track: null },
      straight(-1, 0),
      straight(0, 0),
      straight(1, 0),
      { q: 2, r: 0, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -2, r: 0, color: "red" },
      { q: 2, r: 0, color: "red" },
    ],
    trains: [
      { id: "a", color: "red", source: { q: -2, r: 0 }, destination: { q: 2, r: 0 }, startDelay: 0, required: true },
      { id: "b", color: "red", source: { q: 2, r: 0 }, destination: { q: -2, r: 0 }, startDelay: 0, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: 100 },
    unlockRules: [],
  };
}

// Even number of middle tiles -> two trains SWAP across a shared edge.
function headOnSwap() {
  return {
    id: "collide-swap",
    name: "Swap",
    seed: 1,
    grid: [
      { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
      straight(0, 0),
      straight(1, 0),
      { q: 2, r: 0, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -1, r: 0, color: "red" },
      { q: 2, r: 0, color: "red" },
    ],
    trains: [
      { id: "a", color: "red", source: { q: -1, r: 0 }, destination: { q: 2, r: 0 }, startDelay: 0, required: true },
      { id: "b", color: "red", source: { q: 2, r: 0 }, destination: { q: -1, r: 0 }, startDelay: 0, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: 100 },
    unlockRules: [],
  };
}

test("two trains meeting on the same tile both crash", () => {
  const model = new GameModel();
  model.loadLevel(headOnSameTile());
  model.startRun();
  model.runUntilComplete(50);
  const statuses = model.getState().trains.map((t) => t.status);
  assert.deepEqual(statuses, ["lost", "lost"]);
});

test("two trains swapping positions both crash", () => {
  const model = new GameModel();
  model.loadLevel(headOnSwap());
  model.startRun();
  model.runUntilComplete(50);
  const statuses = model.getState().trains.map((t) => t.status);
  assert.deepEqual(statuses, ["lost", "lost"]);
});
