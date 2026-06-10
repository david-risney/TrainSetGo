// GameModel: the deterministic, DOM-free simulation aggregate.
// See contracts/simulation-api.md. Imports nothing from the browser/DOM. (FR-048..FR-052)

import { TerrainType, TrainStatus, RunOutcome } from "./constants.js";
import { hexEquals, hexKey, neighbor, oppositeEdge } from "./hex.js";
import { loadLevel, stationAt } from "./level.js";
import { Rng } from "./rng.js";
import { completionPct, evaluateUnlocks } from "./unlock.js";
import { ViewEvent } from "../view/view-abstraction.js";
import {
  cycleSwitch,
  hasTrack,
  isEditable,
  isStation,
  makeTrack,
  tileConnectsEdge,
  tileExitEdge,
  tileIsSwitch,
} from "./tile.js";

function fail(reason) {
  return { ok: false, reason };
}
function ok(extra = {}) {
  return { ok: true, ...extra };
}

export class GameModel {
  constructor() {
    this.level = null;
    this.grid = new Map(); // hexKey -> mutable tile
    this.trains = [];
    this.tick = 0;
    this.running = false;
    this.rng = new Rng(0);
    this._sink = null;
    this._allowSwitchDuringRun = true;
  }

  // Optional event sink for audio/feedback (app wires it; model stays DOM-free).
  setEventSink(fn) {
    this._sink = typeof fn === "function" ? fn : null;
  }

  _emit(event) {
    if (this._sink) this._sink(event);
  }

  // --- Loading -------------------------------------------------------------

  loadLevel(def) {
    const level = loadLevel(def);
    this.level = level;
    this.rng = new Rng(level.seed);
    this.tick = 0;
    this.running = false;

    // Working grid: deep copy of authored tiles.
    this.grid = new Map();
    for (const [key, tile] of level.tiles) {
      this.grid.set(key, {
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        lock: tile.lock,
        track: tile.track ? { ...tile.track } : null,
        playerPlaced: false,
      });
    }

    // Runtime trains.
    this.trains = level.trains.map((t) => ({
      ...t,
      status: TrainStatus.WAITING,
      position: { ...t.source },
      enterEdge: null,
    }));
    return ok();
  }

  _tile(hex) {
    return this.grid.get(hexKey(hex)) ?? null;
  }

  // --- Editing API (only while not running) --------------------------------

  placeTrack(hex, shape, orientation = 0, switchState = null) {
    const tile = this._tile(hex);
    if (!tile) return fail("no-tile");
    if (!isEditable(tile)) return fail("locked");
    tile.track = makeTrack(shape, orientation, switchState);
    tile.terrain = TerrainType.TRACK;
    tile.playerPlaced = true;
    this._emit({ type: ViewEvent.PLACE, hex: { ...hex }, shape });
    return ok();
  }

  rotateTrack(hex) {
    const tile = this._tile(hex);
    if (!tile) return fail("no-tile");
    if (!isEditable(tile)) return fail("locked");
    if (!hasTrack(tile)) return fail("no-track");
    tile.track.orientation = (tile.track.orientation + 1) % 6;
    this._emit({ type: ViewEvent.ROTATE, hex: { ...hex } });
    return ok();
  }

  removeTrack(hex) {
    const tile = this._tile(hex);
    if (!tile) return fail("no-tile");
    if (!isEditable(tile)) return fail("locked");
    if (!tile.playerPlaced) return fail("not-player-placed");
    tile.track = null;
    tile.terrain = TerrainType.GRASS;
    tile.playerPlaced = false;
    this._emit({ type: ViewEvent.REMOVE, hex: { ...hex } });
    return ok();
  }

  toggleSwitch(hex) {
    if (this.running && !this._allowSwitchDuringRun) return fail("switch-locked");
    const tile = this._tile(hex);
    if (!tile) return fail("no-tile");
    if (!tileIsSwitch(tile)) return fail("not-switch");
    cycleSwitch(tile);
    this._emit({ type: ViewEvent.SWITCH_TOGGLE, hex: { ...hex }, switchState: tile.track.switchState });
    return ok({ switchState: tile.track.switchState });
  }

  // --- Simulation ----------------------------------------------------------

  startRun() {
    if (this.running) return fail("already-running");
    this.running = true;
    this.tick = 0;
    for (const train of this.trains) {
      train.status = TrainStatus.WAITING;
      train.position = { ...train.source };
      train.enterEdge = null;
    }
    return ok();
  }

  // Compute the intended next move for a running train, or null if it cannot continue.
  _computeNext(train) {
    const here = train.position;
    if (train.enterEdge == null) {
      // Leaving the source station: pick the first connecting neighbor in edge order.
      for (let e = 0; e < 6; e++) {
        const nb = neighbor(here, e);
        const ntile = this.grid.get(hexKey(nb));
        if (ntile && hasTrack(ntile) && tileConnectsEdge(ntile, oppositeEdge(e))) {
          return { hex: nb, enterEdge: oppositeEdge(e) };
        }
      }
      return null;
    }
    const tile = this._tile(here);
    if (!tile || !hasTrack(tile)) return null;
    const exit = tileExitEdge(tile, train.enterEdge);
    if (exit == null) return null;
    const nb = neighbor(here, exit);
    return { hex: nb, enterEdge: oppositeEdge(exit) };
  }

  step() {
    if (!this.running || this.isRunComplete()) return ok({ tick: this.tick });
    this.tick += 1;

    // 1. Departures.
    for (const train of this.trains) {
      if (train.status === TrainStatus.WAITING && this.tick > train.startDelay) {
        train.status = TrainStatus.RUNNING;
        this._emit({ type: ViewEvent.DEPART, trainId: train.id });
      }
    }

    // 2. Intended moves for running trains.
    const active = this.trains.filter((t) => t.status === TrainStatus.RUNNING);
    const intents = new Map(); // train -> { hex, enterEdge } | null
    for (const train of active) intents.set(train, this._computeNext(train));

    // 3. Collision detection among intended moves.
    const crashed = new Set();

    // 3a. End-of-track / no continuation.
    for (const train of active) {
      if (intents.get(train) == null) crashed.add(train);
    }

    // 3b. Two trains targeting the same hex.
    const byTarget = new Map();
    for (const train of active) {
      const next = intents.get(train);
      if (!next) continue;
      const key = hexKey(next.hex);
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(train);
    }
    for (const group of byTarget.values()) {
      if (group.length > 1) for (const t of group) crashed.add(t);
    }

    // 3c. Position swaps (two trains crossing the same edge).
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        const na = intents.get(a);
        const nb = intents.get(b);
        if (na && nb && hexEquals(na.hex, b.position) && hexEquals(nb.hex, a.position)) {
          crashed.add(a);
          crashed.add(b);
        }
      }
    }

    // 4. Apply.
    for (const train of crashed) {
      train.status = TrainStatus.LOST;
      this._emit({ type: ViewEvent.CRASH, trainId: train.id, position: { ...train.position } });
    }

    for (const train of active) {
      if (crashed.has(train)) continue;
      const next = intents.get(train);
      train.position = { ...next.hex };
      train.enterEdge = next.enterEdge;

      const tile = this._tile(next.hex);
      if (tile && isStation(tile)) {
        const station = stationAt(this.level, next.hex);
        const matches =
          hexEquals(next.hex, train.destination) && station && station.color === train.color;
        if (matches) {
          train.status = TrainStatus.COMPLETED;
          this._emit({ type: ViewEvent.ARRIVE, trainId: train.id });
        } else {
          train.status = TrainStatus.LOST;
          this._emit({ type: ViewEvent.CRASH, trainId: train.id, reason: "wrong-station" });
        }
      }
    }

    return ok({ tick: this.tick });
  }

  isRunComplete() {
    if (!this.running) return false;
    return this.trains.every(
      (t) => t.status === TrainStatus.COMPLETED || t.status === TrainStatus.LOST,
    );
  }

  runUntilComplete(maxTicks = 1000) {
    let n = 0;
    while (this.running && !this.isRunComplete() && n < maxTicks) {
      this.step();
      n += 1;
    }
    return this.getRunResult();
  }

  // --- Observation ---------------------------------------------------------

  getState() {
    const tiles = [];
    for (const tile of this.grid.values()) {
      tiles.push({
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        lock: tile.lock,
        track: tile.track ? { ...tile.track } : null,
        playerPlaced: tile.playerPlaced,
      });
    }
    const stations = [];
    if (this.level) {
      for (const s of this.level.stations.values()) stations.push({ ...s });
    }
    return {
      levelId: this.level?.id ?? null,
      tick: this.tick,
      running: this.running,
      tiles,
      stations,
      trains: this.trains.map((t) => ({
        id: t.id,
        color: t.color,
        status: t.status,
        position: { ...t.position },
        headingEdge: t.enterEdge == null ? null : oppositeEdge(t.enterEdge),
      })),
    };
  }

  getRunResult() {
    if (!this.level) return null;
    const deliveredTrainIds = this.trains
      .filter((t) => t.status === TrainStatus.COMPLETED)
      .map((t) => t.id);
    const pct = completionPct(this.level.trains, deliveredTrainIds);
    const outcome =
      pct >= this.level.exitRequirement.minRequiredDeliveredPct
        ? RunOutcome.CLEARED
        : RunOutcome.FAILED;
    return {
      levelId: this.level.id,
      completionPct: pct,
      deliveredTrainIds,
      outcome,
    };
  }

  // Evaluate which levels this run unlocks (used by app/persistence).
  getUnlockedLevelIds() {
    if (!this.level) return [];
    return evaluateUnlocks(this.level.unlockRules, this.getRunResult());
  }
}
