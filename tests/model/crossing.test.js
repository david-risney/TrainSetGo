import test from "node:test";
import assert from "node:assert/strict";
import { GameModel } from "../../src/model/simulation.js";

// A crossing at (0,0) carries two independent lines that must not merge:
//  - horizontal line (edges 0/3): red train (-1,0) -> (1,0)
//  - diagonal line  (edges 1/4): blue train (-1,1) -> (1,-1)
// The blue train is delayed by one tick so the two never occupy the crossing together.
function crossingLevel() {
  return {
    id: "crossing",
    name: "Crossing",
    seed: 1,
    grid: [
      { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: 0, r: 0, terrain: "grass", lock: "editable", track: { shape: "crossing", orientation: 0, switchState: null } },
      { q: 1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: -1, r: 1, terrain: "station", lock: "locked", track: null },
      { q: 1, r: -1, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -1, r: 0, color: "red" },
      { q: 1, r: 0, color: "red" },
      { q: -1, r: 1, color: "blue" },
      { q: 1, r: -1, color: "blue" },
    ],
    trains: [
      { id: "red", color: "red", source: { q: -1, r: 0 }, destination: { q: 1, r: 0 }, startDelay: 0, required: true },
      { id: "blue", color: "blue", source: { q: -1, r: 1 }, destination: { q: 1, r: -1 }, startDelay: 1, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: 100 },
    unlockRules: [],
  };
}

test("both lines pass through a crossing without merging", () => {
  const model = new GameModel();
  model.loadLevel(crossingLevel());
  model.startRun();
  const result = model.runUntilComplete(50);
  const byId = Object.fromEntries(model.getState().trains.map((t) => [t.id, t.status]));
  assert.equal(byId.red, "completed");
  assert.equal(byId.blue, "completed");
  assert.equal(result.outcome, "cleared");
  assert.equal(result.completionPct, 100);
});
