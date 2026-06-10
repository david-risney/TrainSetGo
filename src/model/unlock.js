// Unlock-rule evaluation + completion percentage. Pure logic. (FR-022, FR-023, FR-024)

// Completion percentage over REQUIRED trains only (optional trains excluded). (SC-002)
export function completionPct(trains, deliveredTrainIds) {
  const required = trains.filter((t) => t.required);
  const totalRequired = required.length;
  if (totalRequired === 0) return 100;
  const deliveredSet = new Set(deliveredTrainIds);
  const deliveredRequired = required.filter((t) => deliveredSet.has(t.id)).length;
  return (deliveredRequired / totalRequired) * 100;
}

// Does a single unlock rule fire for the given run result?
// A rule fires when ALL present sub-conditions are satisfied.
export function ruleFires(rule, result) {
  const c = rule.condition;
  if (c.minCompletionPct != null && result.completionPct < c.minCompletionPct) return false;
  if (c.requiredTrainIds != null) {
    const delivered = new Set(result.deliveredTrainIds);
    for (const id of c.requiredTrainIds) {
      if (!delivered.has(id)) return false;
    }
  }
  return true;
}

// Evaluate all unlock rules for a level against a run result.
// Returns a de-duplicated array of newly-unlocked level ids.
export function evaluateUnlocks(unlockRules, result) {
  const unlocked = new Set();
  for (const rule of unlockRules) {
    if (ruleFires(rule, result)) {
      for (const id of rule.unlocks) unlocked.add(id);
    }
  }
  return [...unlocked];
}
