import test from "node:test";
import assert from "node:assert/strict";
import { GameModel } from "../../src/model/simulation.js";

function straightLine(extra = {}) {
  // source(-1,0) -> (0,0) straight -> end-of-track at (1,0) which has no track.
  return {
    id: "lost-end",
    name: "Lost End",
    seed: 1,
    grid: [
      { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: 0, r: 0, terrain: "grass", lock: "editable", track: { shape: "straight", orientation: 0, switchState: null } },
      { q: 1, r: 0, terrain: "grass", lock: "editable", track: null },
      { q: 3, r: 0, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -1, r: 0, color: "red" },
      { q: 3, r: 0, color: "red" },
    ],
    trains: [
      { id: "t1", color: "red", source: { q: -1, r: 0 }, destination: { q: 3, r: 0 }, startDelay: 0, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: 100 },
    unlockRules: [],
    ...extra,
  };
}

test("a train that reaches the end of track is lost", () => {
  const model = new GameModel();
  model.loadLevel(straightLine());
  model.startRun();
  const result = model.runUntilComplete(50);
  assert.equal(model.getState().trains[0].status, "lost");
  assert.equal(result.completionPct, 0);
  assert.equal(result.outcome, "failed");
});

test("a train arriving at a wrong-color station is lost", () => {
  const level = {
    id: "wrong-color",
    name: "Wrong Color",
    seed: 1,
    grid: [
      { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: 0, r: 0, terrain: "grass", lock: "editable", track: { shape: "straight", orientation: 0, switchState: null } },
      { q: 1, r: 0, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -1, r: 0, color: "red" },
      { q: 1, r: 0, color: "blue" },
    ],
    // train is red but its destination station (1,0) is blue -> lost on arrival.
    trains: [
      { id: "t1", color: "red", source: { q: -1, r: 0 }, destination: { q: 1, r: 0 }, startDelay: 0, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: 100 },
    unlockRules: [],
  };
  const model = new GameModel();
  model.loadLevel(level);
  model.startRun();
  model.runUntilComplete(50);
  assert.equal(model.getState().trains[0].status, "lost");
});
