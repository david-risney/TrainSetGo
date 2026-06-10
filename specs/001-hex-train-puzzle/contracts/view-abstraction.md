# Contract: View Abstraction

The presentation boundary (`src/view/view-abstraction.js`) through which the game model is observed
and rendered (FR-050/052). A **real** implementation draws the isometric voxel scene and plays
audio; a **test** implementation (`tests/model/support/test-view.js`) records what it is told for
assertions, requiring no canvas/DOM. This is what lets game-model tests run headlessly.

## Interface

A View implements these methods; the app calls them, the model never imports a concrete view.

| Method | Purpose |
|--------|---------|
| `render(stateSnapshot)` | Present the current `GameModel.getState()` snapshot (tiles, trains, statuses). Real view draws a frame; test view stores the latest snapshot. |
| `onEvent(event)` | Receive discrete gameplay events for audio/feedback: `{ type: "depart" \| "arrive" \| "crash" \| "switchToggle" \| "place" \| "rotate", ... }` (FR-042). Test view appends to an event log. |
| `setCamera({ zoom, panX, panY })` | Apply zoom/pan (real view only; no-op in test view) (FR-040). |
| `dispose()` | Release resources (real view: listeners, audio nodes). |

## Input port (separate, model-facing)

Input is injected into the **model** as semantic commands, not raw DOM events, so the model stays
device-agnostic. `src/view/input.js` (Pointer Events) translates gestures → these commands; tests
call the same model methods directly:

- `placeTrack(hex, shape, orientation)`, `rotateTrack(hex)`, `removeTrack(hex)`,
  `toggleSwitch(hex)`, `startRun()`, `step()` — see simulation-api.md.

## Contract guarantees

- The model produces plain-data snapshots/events only; it holds no reference to a concrete view,
  canvas, audio context, or DOM node (enforces FR-050).
- Any view implementation that records `render()` snapshots and `onEvent()` calls can fully verify
  model behavior without graphics (FR-052, SC-013).
- Swapping the real view for the test view changes nothing about model outcomes (determinism is a
  model property, not a view property).

## Test view sketch

```js
// tests/model/support/test-view.js
export class TestView {
  constructor() { this.lastSnapshot = null; this.events = []; }
  render(snapshot) { this.lastSnapshot = snapshot; }
  onEvent(event) { this.events.push(event); }
  setCamera() {}
  dispose() {}
}
```
