import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GameModel } from "../../src/model/simulation.js";
import { TestView } from "./support/test-view.js";

const here = dirname(fileURLToPath(import.meta.url));
const levelA = JSON.parse(readFileSync(join(here, "../../src/levels/level-a.json"), "utf8"));

test("completing all paths delivers every train and clears the level", () => {
  const model = new GameModel();
  const view = new TestView();
  model.setEventSink((e) => view.onEvent(e));
  model.loadLevel(levelA);

  // Each of the three corridors has a single editable gap at q=0.
  assert.ok(model.placeTrack({ q: 0, r: 0 }, "straight", 0).ok);
  assert.ok(model.placeTrack({ q: 0, r: 2 }, "straight", 0).ok);
  assert.ok(model.placeTrack({ q: 0, r: -2 }, "straight", 0).ok);

  model.startRun();
  const result = model.runUntilComplete(200);

  view.render(model.getState());
  assert.equal(view.trainById("t1").status, "completed");
  assert.equal(result.outcome, "cleared");
  assert.equal(result.completionPct, 100);
  assert.deepEqual(result.deliveredTrainIds.sort(), ["t1", "t2", "t3"]);
  assert.ok(view.eventsOfType("arrive").length >= 3);
});

test("editing is rejected on locked tiles but allowed during a run (arcade)", () => {
  const model = new GameModel();
  model.loadLevel(levelA);
  // (-2,0) is a locked station.
  assert.equal(model.placeTrack({ q: -2, r: 0 }, "straight", 0).ok, false);

  model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  model.startRun();
  // Arcade mode: the player keeps editing unlocked tiles while trains run.
  assert.equal(model.rotateTrack({ q: 0, r: 0 }).ok, true);
  assert.equal(model.removeTrack({ q: 0, r: 0 }).ok, true);
  assert.equal(model.placeTrack({ q: 0, r: 0 }, "straight", 0).ok, true);
  // Locked tiles remain off-limits even during a run.
  assert.equal(model.placeTrack({ q: -2, r: 0 }, "straight", 0).ok, false);
});

test("rotateTrack advances orientation; removeTrack clears a player tile", () => {
  const model = new GameModel();
  model.loadLevel(levelA);
  model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  model.rotateTrack({ q: 0, r: 0 });
  const tile = model.getState().tiles.find((t) => t.q === 0 && t.r === 0);
  assert.equal(tile.track.orientation, 1);
  assert.ok(model.removeTrack({ q: 0, r: 0 }).ok);
  const cleared = model.getState().tiles.find((t) => t.q === 0 && t.r === 0);
  assert.equal(cleared.track, null);
});
