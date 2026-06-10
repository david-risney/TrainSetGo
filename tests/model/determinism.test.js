import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GameModel } from "../../src/model/simulation.js";

const here = dirname(fileURLToPath(import.meta.url));
const levelA = JSON.parse(readFileSync(join(here, "../../src/levels/level-a.json"), "utf8"));

function runScripted() {
  const model = new GameModel();
  model.loadLevel(levelA);
  model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  model.startRun();
  const states = [];
  for (let i = 0; i < 12 && !model.isRunComplete(); i++) {
    model.step();
    states.push(JSON.stringify(model.getState()));
  }
  return { states, result: model.getRunResult() };
}

test("same level + seed + scripted input yields identical state every tick", () => {
  const a = runScripted();
  const b = runScripted();
  assert.deepEqual(a.states, b.states);
  assert.deepEqual(a.result, b.result);
});

test("step advances exactly one tick", () => {
  const model = new GameModel();
  model.loadLevel(levelA);
  model.placeTrack({ q: 0, r: 0 }, "straight", 0);
  model.startRun();
  assert.equal(model.getState().tick, 0);
  model.step();
  assert.equal(model.getState().tick, 1);
  model.step();
  assert.equal(model.getState().tick, 2);
});
