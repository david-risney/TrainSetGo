import test from "node:test";
import assert from "node:assert/strict";
import { GameModel } from "../../src/model/simulation.js";
import { loadLevel } from "../../src/model/level.js";

// Simulates what the editor produces: a plain level JSON object. It must load and
// validate identically to its authored layout, and be playable to completion. (SC-005)
function authoredLevel() {
  return {
    id: "authored",
    name: "Authored Minimal",
    seed: 42,
    grid: [
      { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: 0, r: 0, terrain: "grass", lock: "editable", track: null },
      { q: 1, r: 0, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -1, r: 0, color: "green" },
      { q: 1, r: 0, color: "green" },
    ],
    trains: [
      { id: "g1", name: "Green", color: "green", source: { q: -1, r: 0 }, destination: { q: 1, r: 0 }, startDelay: 0, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: 100 },
    unlockRules: [{ condition: { minCompletionPct: 100 }, unlocks: ["next"] }],
  };
}

test("an editor-authored level validates and preserves its structure", () => {
  const def = authoredLevel();
  const level = loadLevel(def);
  assert.equal(level.id, "authored");
  assert.equal(level.stations.size, 2);
  assert.equal(level.trains.length, 1);
  assert.equal(level.trains[0].name, "Green");
  assert.equal(level.exitRequirement.minRequiredDeliveredPct, 100);
});

test("the authored level is playable to a successful completion", () => {
  const model = new GameModel();
  model.loadLevel(authoredLevel());
  model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  model.startRun();
  const result = model.runUntilComplete(50);
  assert.equal(result.outcome, "cleared");
  assert.deepEqual(model.getUnlockedLevelIds(), ["next"]);
});

test("invalid authored level (train referencing a non-station) is rejected", () => {
  const bad = authoredLevel();
  bad.trains[0].destination = { q: 9, r: 9 };
  assert.throws(() => loadLevel(bad));
});
