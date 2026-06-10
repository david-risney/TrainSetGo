// Save / game-state persistence. Pure serialization + a thin storage wrapper.
// localStorage is injected so this module stays testable in Node. See contracts/save-schema.md.
// (FR-028..FR-032)

export const SAVE_KEY = "trainsetgo.save";
export const SCHEMA_VERSION = 1;

export function defaultSettings() {
  return { musicVolume: 0.8, sfxVolume: 1.0, musicMuted: false, sfxMuted: false };
}

// A fresh game state seeded from the campaign manifest's initialUnlocked. (FR-031)
export function freshState(manifest) {
  return {
    schemaVersion: SCHEMA_VERSION,
    unlockedLevelIds: [...(manifest?.initialUnlocked ?? [])],
    bestResults: {},
    inProgress: null,
    settings: defaultSettings(),
  };
}

function clamp01(n, fallback) {
  return typeof n === "number" && n >= 0 && n <= 1 ? n : fallback;
}

// Normalize/validate a parsed document against a manifest, pruning unknown level ids
// and dropping incompatible in-progress state. (invariants + safe fallback)
export function normalize(doc, manifest) {
  const known = new Set((manifest?.levels ?? []).map((l) => l.id));
  const base = freshState(manifest);
  if (!doc || typeof doc !== "object") return base;

  const unlocked = Array.isArray(doc.unlockedLevelIds)
    ? [...new Set(doc.unlockedLevelIds.filter((id) => known.size === 0 || known.has(id)))]
    : base.unlockedLevelIds;

  const bestResults = {};
  if (doc.bestResults && typeof doc.bestResults === "object") {
    for (const [id, r] of Object.entries(doc.bestResults)) {
      if ((known.size === 0 || known.has(id)) && r && typeof r === "object") bestResults[id] = r;
    }
  }

  let inProgress = null;
  if (doc.inProgress && typeof doc.inProgress === "object") {
    const id = doc.inProgress.levelId;
    if (known.size === 0 || known.has(id)) inProgress = doc.inProgress;
  }

  const s = doc.settings ?? {};
  const def = defaultSettings();
  const settings = {
    musicVolume: clamp01(s.musicVolume, def.musicVolume),
    sfxVolume: clamp01(s.sfxVolume, def.sfxVolume),
    musicMuted: typeof s.musicMuted === "boolean" ? s.musicMuted : def.musicMuted,
    sfxMuted: typeof s.sfxMuted === "boolean" ? s.sfxMuted : def.sfxMuted,
  };

  // Always ensure initial levels remain unlocked.
  for (const id of base.unlockedLevelIds) if (!unlocked.includes(id)) unlocked.push(id);

  return { schemaVersion: SCHEMA_VERSION, unlockedLevelIds: unlocked, bestResults, inProgress, settings };
}

// Migrate an older document forward. (only v1 exists today)
export function migrate(doc) {
  if (!doc || typeof doc !== "object") return doc;
  // Future migrations keyed on doc.schemaVersion go here.
  return doc;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text, manifest) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return freshState(manifest);
  }
  return normalize(migrate(parsed), manifest);
}

// Strictly-better comparison for best-result replacement. (FR-032)
export function isBetterResult(next, prev) {
  if (!prev) return true;
  if (next.completionPct > prev.completionPct) return true;
  if (next.completionPct < prev.completionPct) return false;
  // Equal pct: better iff strict superset of delivered trains.
  const prevSet = new Set(prev.deliveredTrainIds ?? []);
  const nextSet = new Set(next.deliveredTrainIds ?? []);
  if (nextSet.size <= prevSet.size) return false;
  for (const id of prevSet) if (!nextSet.has(id)) return false;
  return true;
}

export function updateBestResult(state, result) {
  const prev = state.bestResults[result.levelId];
  if (isBetterResult(result, prev)) {
    state.bestResults[result.levelId] = result;
    return true;
  }
  return false;
}

export function applyUnlocks(state, levelIds) {
  let changed = false;
  for (const id of levelIds) {
    if (!state.unlockedLevelIds.includes(id)) {
      state.unlockedLevelIds.push(id);
      changed = true;
    }
  }
  return changed;
}

// Thin wrapper over an injected Storage-like object (localStorage in the browser).
export class SaveStore {
  constructor(storage, manifest) {
    this.storage = storage ?? null;
    this.manifest = manifest ?? null;
  }

  load() {
    let text = null;
    try {
      text = this.storage?.getItem(SAVE_KEY) ?? null;
    } catch {
      text = null;
    }
    if (text == null) return freshState(this.manifest);
    return deserialize(text, this.manifest);
  }

  save(state) {
    try {
      this.storage?.setItem(SAVE_KEY, serialize(state));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}
