import test from "node:test";
import assert from "node:assert/strict";
import { completionPct, evaluateUnlocks, ruleFires } from "../../src/model/unlock.js";

const trains = [
  { id: "t1", required: true },
  { id: "t2", required: true },
  { id: "t3", required: false },
];

test("completionPct counts required trains only", () => {
  assert.equal(completionPct(trains, ["t1", "t2"]), 100);
  assert.equal(completionPct(trains, ["t1"]), 50);
  assert.equal(completionPct(trains, ["t1", "t3"]), 50); // optional t3 ignored
  assert.equal(completionPct(trains, []), 0);
});

test("completionPct is 100 when there are no required trains", () => {
  assert.equal(completionPct([{ id: "x", required: false }], []), 100);
});

test("ruleFires on percentage threshold", () => {
  const rule = { condition: { minCompletionPct: 70, requiredTrainIds: null }, unlocks: ["b"] };
  assert.ok(ruleFires(rule, { completionPct: 70, deliveredTrainIds: [] }));
  assert.ok(!ruleFires(rule, { completionPct: 69, deliveredTrainIds: [] }));
});

test("ruleFires requires all named trains delivered", () => {
  const rule = { condition: { minCompletionPct: null, requiredTrainIds: ["t1", "t3"] }, unlocks: ["c"] };
  assert.ok(ruleFires(rule, { completionPct: 0, deliveredTrainIds: ["t1", "t3"] }));
  assert.ok(!ruleFires(rule, { completionPct: 100, deliveredTrainIds: ["t1"] }));
});

test("evaluateUnlocks de-duplicates across multiple rules", () => {
  const rules = [
    { condition: { minCompletionPct: 70, requiredTrainIds: null }, unlocks: ["level-b"] },
    { condition: { minCompletionPct: 100, requiredTrainIds: null }, unlocks: ["level-a-special"] },
    { condition: { minCompletionPct: null, requiredTrainIds: ["t1"] }, unlocks: ["level-b"] },
  ];
  const at100 = evaluateUnlocks(rules, { completionPct: 100, deliveredTrainIds: ["t1"] });
  assert.deepEqual(at100.sort(), ["level-a-special", "level-b"]);
  const at70 = evaluateUnlocks(rules, { completionPct: 70, deliveredTrainIds: ["t1"] });
  assert.deepEqual(at70.sort(), ["level-b"]);
});
