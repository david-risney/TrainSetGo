import test from "node:test";
import assert from "node:assert/strict";
import { GameModel } from "../../src/model/simulation.js";

// Two required trains; one has a complete path (delivered), one has no track (lost).
// Result is therefore 50% of required trains.
function twoRequired(minPct) {
  return {
    id: "exit-req",
    name: "Exit Requirement",
    seed: 1,
    grid: [
      { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: 0, r: 0, terrain: "grass", lock: "editable", track: { shape: "straight", orientation: 0, switchState: null } },
      { q: 1, r: 0, terrain: "station", lock: "locked", track: null },
      { q: -1, r: 2, terrain: "station", lock: "locked", track: null },
      { q: 0, r: 2, terrain: "grass", lock: "editable", track: null },
      { q: 1, r: 2, terrain: "station", lock: "locked", track: null },
    ],
    stations: [
      { q: -1, r: 0, color: "red" },
      { q: 1, r: 0, color: "red" },
      { q: -1, r: 2, color: "blue" },
      { q: 1, r: 2, color: "blue" },
    ],
    trains: [
      { id: "t1", color: "red", source: { q: -1, r: 0 }, destination: { q: 1, r: 0 }, startDelay: 0, required: true },
      { id: "t2", color: "blue", source: { q: -1, r: 2 }, destination: { q: 1, r: 2 }, startDelay: 0, required: true },
    ],
    exitRequirement: { minRequiredDeliveredPct: minPct },
    unlockRules: [],
  };
}

test("delivering half of required trains yields 50% completion", () => {
  const model = new GameModel();
  model.loadLevel(twoRequired(50));
  model.startRun();
  const result = model.runUntilComplete(50);
  assert.equal(result.completionPct, 50);
  assert.deepEqual(result.deliveredTrainIds, ["t1"]);
});

test("50% clears a 50% requirement but fails a 70% requirement", () => {
  const cleared = new GameModel();
  cleared.loadLevel(twoRequired(50));
  cleared.startRun();
  assert.equal(cleared.runUntilComplete(50).outcome, "cleared");

  const failed = new GameModel();
  failed.loadLevel(twoRequired(70));
  failed.startRun();
  assert.equal(failed.runUntilComplete(50).outcome, "failed");
});
