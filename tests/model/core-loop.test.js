import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GameModel } from "../../src/model/simulation.js";
import { TestView } from "./support/test-view.js";

const here = dirname(fileURLToPath(import.meta.url));
const levelA = JSON.parse(readFileSync(join(here, "../../src/levels/level-a.json"), "utf8"));

test("completing the path delivers the train and clears the level", () => {
  const model = new GameModel();
  const view = new TestView();
  model.setEventSink((e) => view.onEvent(e));
  model.loadLevel(levelA);

  // The only gap is at (0,0); place a straight to bridge it.
  const res = model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  assert.ok(res.ok);

  model.startRun();
  const result = model.runUntilComplete(200);

  view.render(model.getState());
  assert.equal(view.trainById("t1").status, "completed");
  assert.equal(result.outcome, "cleared");
  assert.equal(result.completionPct, 100);
  assert.deepEqual(result.deliveredTrainIds, ["t1"]);
  assert.ok(view.eventsOfType("arrive").length >= 1);
});

test("editing is rejected on locked tiles and while running", () => {
  const model = new GameModel();
  model.loadLevel(levelA);
  // (-1,0) is a locked station.
  assert.equal(model.placeTrack({ q: -1, r: 0 }, "straight", 0).ok, false);

  model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  model.startRun();
  // No edits allowed during a run.
  assert.equal(model.placeTrack({ q: 0, r: 0 }, "straight", 0).ok, false);
  assert.equal(model.rotateTrack({ q: 0, r: 0 }).ok, false);
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
