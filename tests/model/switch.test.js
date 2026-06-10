import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GameModel } from "../../src/model/simulation.js";

const here = dirname(fileURLToPath(import.meta.url));
const levelSwitch = JSON.parse(readFileSync(join(here, "../../src/levels/level-switch.json"), "utf8"));

test("with the switch on its default branch the train reaches its station", () => {
  const model = new GameModel();
  model.loadLevel(levelSwitch);
  model.startRun();
  const result = model.runUntilComplete(50);
  assert.equal(model.getState().trains[0].status, "completed");
  assert.equal(result.outcome, "cleared");
});

test("toggling the switch routes the train down the other branch (lost)", () => {
  const model = new GameModel();
  model.loadLevel(levelSwitch);
  const before = model.getState().tiles.find((t) => t.q === 0 && t.r === 0).track.switchState;
  model.toggleSwitch({ q: 0, r: 0 });
  const after = model.getState().tiles.find((t) => t.q === 0 && t.r === 0).track.switchState;
  assert.notEqual(before, after);

  model.startRun();
  model.runUntilComplete(50);
  // The red train now diverges to the blue station -> wrong destination -> lost.
  assert.equal(model.getState().trains[0].status, "lost");
});

test("toggling a switch twice returns to the original branch", () => {
  const model = new GameModel();
  model.loadLevel(levelSwitch);
  const orig = model.getState().tiles.find((t) => t.q === 0 && t.r === 0).track.switchState;
  model.toggleSwitch({ q: 0, r: 0 });
  model.toggleSwitch({ q: 0, r: 0 });
  const back = model.getState().tiles.find((t) => t.q === 0 && t.r === 0).track.switchState;
  assert.equal(orig, back);
});
