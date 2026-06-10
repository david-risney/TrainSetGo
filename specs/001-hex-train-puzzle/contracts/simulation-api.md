# Contract: Game Model (Simulation) API

The public surface of `src/model/` — a deterministic, DOM-free aggregate used by both the app
and the game-model tests (FR-048–FR-054, SC-012/013). All randomness derives from a seeded PRNG;
`step()` advances exactly one tick. The model imports nothing from the browser/DOM.

## Construction

```js
import { GameModel } from "../src/model/simulation.js";

const model = new GameModel();
model.loadLevel(levelJson);   // validates and initializes working state; seeds RNG from level.seed
```

## Editing API (allowed only while not running — FR-009)

| Method | Effect | Constraints |
|--------|--------|-------------|
| `placeTrack(hex, shape, orientation)` | Place a track tile on an editable grass tile | Rejects on locked tiles (FR-006) |
| `rotateTrack(hex)` | Rotate placed track to next orientation (0→5→0) | Editable, has track |
| `removeTrack(hex)` | Remove a player-placed track tile | Editable, player-placed |
| `toggleSwitch(hex)` | Cycle a switch tile's active branch | Tile is a `switch` |

- Each returns a result indicating success or a rejection reason; rejected edits leave state
  unchanged (acceptance scenarios in spec US1).

## Simulation API

| Method | Effect |
|--------|--------|
| `startRun()` | Transition from editing to running; trains enter `waiting`; locks the layout (FR-009). `toggleSwitch` remains allowed during a run if the level permits (default allowed). |
| `step()` | Advance exactly one tick: depart due trains (FR-010), move running trains one tile, resolve completions (FR-013), end-of-track crashes (FR-014), collisions (FR-015, both lost), wrong-station arrivals (FR-016). |
| `isRunComplete()` | `true` when every train is `completed` or `lost` (FR-018). |
| `runUntilComplete(maxTicks)` | Convenience: `step()` until complete or `maxTicks` reached (test helper). |

## Observation API

| Method | Returns |
|--------|---------|
| `getState()` | Immutable snapshot: `tick`, tiles (with track/orientation/switchState), trains (`id`, `color`, `status`, `position`, `headingEdge`). Used by the View Abstraction and by tests. |
| `getRunResult()` | `RunResult` once complete: `{ levelId, completionPct, deliveredTrainIds, outcome }` (FR-021/022). `completionPct` is over **required** trains only. |

## Determinism contract (FR-048, SC-012)

Given the same `levelJson` (hence same `seed`) and the same ordered sequence of editing/simulation
calls, two `GameModel` instances MUST produce identical `getState()` snapshots at every tick and an
identical `getRunResult()`. No method reads wall-clock time or `Math.random`.

## Collision semantics (FR-015, spec assumptions)

Within a single `step()`, if two trains would occupy the same hex — including a position swap
across a shared edge — both transition to `lost`. Resolution is order-independent given the tick
model.

## Example (game-model test shape)

```js
import test from "node:test";
import assert from "node:assert/strict";
import { GameModel } from "../../src/model/simulation.js";
import level from "../../src/levels/level-a.json" with { type: "json" };

test("red train reaches red station when path is complete", () => {
  const model = new GameModel();
  model.loadLevel(level);
  model.placeTrack({ q: 0, r: 0 }, "straight", 0);   // scripted input
  model.startRun();
  model.runUntilComplete(200);
  const result = model.getRunResult();
  assert.equal(result.outcome, "cleared");
  assert.ok(result.deliveredTrainIds.includes("t1"));
});
```
