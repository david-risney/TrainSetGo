import test from "node:test";
import assert from "node:assert/strict";
import {
  SaveStore,
  defaultSettings,
  deserialize,
  freshState,
  isBetterResult,
  serialize,
  updateBestResult,
} from "../../src/model/save.js";

const manifest = {
  schemaVersion: 1,
  levels: [{ id: "level-a" }, { id: "level-b" }],
  initialUnlocked: ["level-a"],
};

// In-memory localStorage-like stub.
class MemStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, v);
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

test("freshState seeds initialUnlocked and defaults", () => {
  const s = freshState(manifest);
  assert.deepEqual(s.unlockedLevelIds, ["level-a"]);
  assert.deepEqual(s.settings, defaultSettings());
  assert.equal(s.inProgress, null);
});

test("serialize/deserialize round-trips", () => {
  const s = freshState(manifest);
  s.bestResults["level-a"] = {
    levelId: "level-a",
    completionPct: 80,
    deliveredTrainIds: ["t1"],
    outcome: "cleared",
  };
  const back = deserialize(serialize(s), manifest);
  assert.equal(back.bestResults["level-a"].completionPct, 80);
});

test("deserialize falls back to fresh on corrupt JSON", () => {
  const s = deserialize("{not json", manifest);
  assert.deepEqual(s.unlockedLevelIds, ["level-a"]);
});

test("normalize prunes unknown level ids but keeps initial unlocked", () => {
  const doc = { schemaVersion: 1, unlockedLevelIds: ["level-z"], bestResults: {}, settings: {} };
  const s = deserialize(JSON.stringify(doc), manifest);
  assert.ok(s.unlockedLevelIds.includes("level-a"));
  assert.ok(!s.unlockedLevelIds.includes("level-z"));
});

test("in-progress for missing level is dropped, unlocks preserved", () => {
  const doc = {
    schemaVersion: 1,
    unlockedLevelIds: ["level-a", "level-b"],
    bestResults: {},
    inProgress: { levelId: "ghost", tilePlacements: [], switchStates: [] },
    settings: {},
  };
  const s = deserialize(JSON.stringify(doc), manifest);
  assert.equal(s.inProgress, null);
  assert.deepEqual(s.unlockedLevelIds.sort(), ["level-a", "level-b"]);
});

test("isBetterResult: higher pct wins; equal pct needs superset of trains", () => {
  const prev = { completionPct: 70, deliveredTrainIds: ["t1"] };
  assert.ok(isBetterResult({ completionPct: 80, deliveredTrainIds: [] }, prev));
  assert.ok(!isBetterResult({ completionPct: 60, deliveredTrainIds: ["t1", "t2"] }, prev));
  assert.ok(isBetterResult({ completionPct: 70, deliveredTrainIds: ["t1", "t2"] }, prev));
  assert.ok(!isBetterResult({ completionPct: 70, deliveredTrainIds: ["t2"] }, prev));
});

test("updateBestResult only replaces when strictly better", () => {
  const state = freshState(manifest);
  assert.ok(updateBestResult(state, { levelId: "level-a", completionPct: 70, deliveredTrainIds: ["t1"], outcome: "cleared" }));
  assert.ok(!updateBestResult(state, { levelId: "level-a", completionPct: 70, deliveredTrainIds: ["t1"], outcome: "cleared" }));
  assert.ok(updateBestResult(state, { levelId: "level-a", completionPct: 100, deliveredTrainIds: ["t1"], outcome: "cleared" }));
});

test("SaveStore persists and restores via injected storage", () => {
  const storage = new MemStorage();
  const store = new SaveStore(storage, manifest);
  const s = store.load();
  s.unlockedLevelIds.push("level-b");
  store.save(s);
  const reloaded = new SaveStore(storage, manifest).load();
  assert.ok(reloaded.unlockedLevelIds.includes("level-b"));
});
