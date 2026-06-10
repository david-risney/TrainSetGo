// Level loader + validation per contracts/level-schema.md. Pure logic. (FR-019)

import { LockState, TerrainType } from "./constants.js";
import { hexKey } from "./hex.js";
import { makeTile, makeTrack } from "./tile.js";

export class LevelValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LevelValidationError";
  }
}

function assert(cond, msg) {
  if (!cond) throw new LevelValidationError(msg);
}

// Parse + validate a level definition. Returns a normalized Level object.
export function loadLevel(def) {
  assert(def && typeof def === "object", "Level definition must be an object");
  assert(typeof def.id === "string" && def.id.length > 0, "Level id must be a non-empty string");
  assert(typeof def.name === "string", "Level name must be a string");

  const seed = Number.isInteger(def.seed) ? def.seed : 0;

  // Grid
  assert(Array.isArray(def.grid), "Level grid must be an array");
  const tiles = new Map();
  for (const cell of def.grid) {
    assert(Number.isInteger(cell.q) && Number.isInteger(cell.r), "Tile q/r must be integers");
    const key = hexKey(cell);
    assert(!tiles.has(key), `Duplicate tile at ${key}`);
    assert(
      Object.values(TerrainType).includes(cell.terrain),
      `Unknown terrain '${cell.terrain}' at ${key}`,
    );
    const lock = cell.lock === LockState.EDITABLE ? LockState.EDITABLE : LockState.LOCKED;
    assert(
      lock !== LockState.EDITABLE || cell.terrain === TerrainType.GRASS,
      `Only grass tiles may be editable (at ${key})`,
    );
    let track = null;
    if (cell.track) {
      track = makeTrack(cell.track.shape, cell.track.orientation ?? 0, cell.track.switchState ?? null);
    }
    tiles.set(key, makeTile(cell.q, cell.r, cell.terrain, lock, track, false));
  }

  // Stations
  assert(Array.isArray(def.stations), "Level stations must be an array");
  const stations = new Map();
  for (const s of def.stations) {
    assert(Number.isInteger(s.q) && Number.isInteger(s.r), "Station q/r must be integers");
    assert(typeof s.color === "string", "Station color must be a string");
    stations.set(hexKey(s), { q: s.q, r: s.r, color: s.color });
  }

  // Trains
  assert(Array.isArray(def.trains), "Level trains must be an array");
  const trains = def.trains.map((t, i) => {
    assert(typeof t.id === "string" && t.id.length > 0, `Train[${i}] id required`);
    assert(typeof t.color === "string", `Train ${t.id} color required`);
    assert(t.source && stations.has(hexKey(t.source)), `Train ${t.id} source must be a station`);
    assert(
      t.destination && stations.has(hexKey(t.destination)),
      `Train ${t.id} destination must be a station`,
    );
    return {
      id: t.id,
      name: t.name ?? null,
      color: t.color,
      source: { q: t.source.q, r: t.source.r },
      destination: { q: t.destination.q, r: t.destination.r },
      startDelay: Number.isInteger(t.startDelay) ? t.startDelay : 0,
      required: t.required !== false,
    };
  });
  const trainIds = new Set(trains.map((t) => t.id));

  // Exit requirement
  const minPct = def.exitRequirement?.minRequiredDeliveredPct;
  assert(
    typeof minPct === "number" && minPct >= 0 && minPct <= 100,
    "exitRequirement.minRequiredDeliveredPct must be 0..100",
  );

  // Unlock rules
  const unlockRules = (def.unlockRules ?? []).map((rule, i) => {
    const c = rule.condition ?? {};
    const hasPct = typeof c.minCompletionPct === "number";
    const hasTrains = Array.isArray(c.requiredTrainIds) && c.requiredTrainIds.length > 0;
    assert(hasPct || hasTrains, `unlockRules[${i}] needs minCompletionPct or requiredTrainIds`);
    if (hasPct) {
      assert(c.minCompletionPct >= 0 && c.minCompletionPct <= 100, `unlockRules[${i}] pct 0..100`);
    }
    if (hasTrains) {
      for (const id of c.requiredTrainIds) {
        assert(trainIds.has(id), `unlockRules[${i}] references unknown train '${id}'`);
      }
    }
    assert(Array.isArray(rule.unlocks) && rule.unlocks.length > 0, `unlockRules[${i}] needs unlocks`);
    return {
      condition: {
        minCompletionPct: hasPct ? c.minCompletionPct : null,
        requiredTrainIds: hasTrains ? [...c.requiredTrainIds] : null,
      },
      unlocks: [...rule.unlocks],
    };
  });

  return {
    id: def.id,
    name: def.name,
    seed,
    tiles,
    stations,
    trains,
    exitRequirement: { minRequiredDeliveredPct: minPct },
    unlockRules,
  };
}

export function stationAt(level, hex) {
  return level.stations.get(hexKey(hex)) ?? null;
}
