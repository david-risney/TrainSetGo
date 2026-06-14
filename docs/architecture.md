# Architecture

TrainSetGo is a static, vanilla-JavaScript hex-tile train-routing puzzle. It ships as
plain HTML/CSS/ES2022 modules with **no build step, no framework, and no bundler** — the
browser loads `src/app.js` directly. This document explains how the code is organized and
why.

> For the canonical product/feature requirements, see
> [`specs/001-hex-train-puzzle/`](../specs/001-hex-train-puzzle/) (spec, plan, data-model,
> and the `contracts/` interface docs). For the non-negotiable project principles, see the
> [constitution](../.specify/memory/constitution.md).

## The one rule that drives everything: model ⇄ view split

The codebase is split into three layers under `src/`:

| Layer | Directory | May touch the DOM/browser? | Imports allowed |
| --- | --- | --- | --- |
| **Model** | `src/model/` | **No.** Pure, deterministic logic. Must be importable in Node. | Other `model/` modules only. |
| **View** | `src/view/` | Yes — Canvas, Web Audio, Pointer Events. | `model/` + other `view/`. |
| **UI** | `src/ui/` | Yes — builds DOM screens. | `model/`, `view/`, `ui/`. |
| **App** | `src/app.js` | Yes — the composition root. | Everything. |

**Why:** the model is the part that must be correct and testable. Keeping it DOM-free means
the entire game can be simulated headlessly in `node --test` with no browser, and runs are
fully reproducible from a level seed (the model never calls `Math.random` or reads the wall
clock — see [`src/model/rng.js`](../src/model/rng.js)).

If you find yourself wanting to `import` something from `view/` or `ui/` inside `model/`,
**stop** — that is an architecture violation. The one sanctioned coupling point is the
event-type contract: the model imports `ViewEvent` constants from
[`src/view/view-abstraction.js`](../src/view/view-abstraction.js) purely as a shared
string enum, and emits events through an injected sink (`setEventSink`) rather than calling
the view directly.

## Module map

### Model (`src/model/`) — deterministic core

| Module | Responsibility |
| --- | --- |
| `constants.js` | Frozen enums: `TerrainType`, `TrackShape`, `LockState`, `TrainStatus`, `RunOutcome`, `ColorTheme`. |
| `hex.js` | Axial (pointy-top) hex math: neighbors, edges (0–5), `oppositeEdge`, `rotateEdge`, distance. |
| `track.js` | **Single source of truth** for track connectivity: `connectionPairs`/`connectedEdges`/`exitEdge` map a `(shape, orientation, switchState)` to the edges it links. |
| `tile.js` | Tile + `TrackPlacement` data helpers that delegate edge questions to `track.js`. |
| `level.js` | Loads + validates a level definition (throws `LevelValidationError`). |
| `unlock.js` | Completion-percentage + unlock-rule evaluation. |
| `rng.js` | Seeded `mulberry32` PRNG wrapper. |
| `save.js` | Versioned save serialization, normalization/migration, and the `SaveStore` storage wrapper. |
| `simulation.js` | `GameModel`: the aggregate. Loading, the editing API, the tick-based train simulation, and `getState()` snapshots. |

`GameModel` is the public model surface (see
[`contracts/simulation-api.md`](../specs/001-hex-train-puzzle/contracts/simulation-api.md)).
Key methods:

- **Editing** (only valid before/while running, on editable tiles): `placeTrack`,
  `placeTrackAutoFit` (rotates to best fit via `bestOrientation`), `rotateTrack`,
  `removeTrack`, `toggleSwitch`. Each returns `{ ok, reason? }`.
- **Simulation**: `startRun`, `step` (one tick: departures → intended moves → collision
  detection → apply), `isRunComplete`, `runUntilComplete` (used by tests to fast-forward).
- **Observation**: `getState()` returns a plain snapshot `{ tiles, stations, trains, ... }`;
  `getRunResult()` returns `{ completionPct, deliveredTrainIds, outcome }`.

### View (`src/view/`) — browser-only presentation

| Module | Responsibility |
| --- | --- |
| `renderer.js` | Canvas 2D isometric compositor. Projects axial hexes to a squished iso layout and paints terrain/track/stations/trains as voxel prisms. Owns all camera transforms (`zoomAt`, `rotateAt`, `fitWorld`, `worldToScreen`, `screenToHex`). |
| `camera.js` | Plain `{ zoom, pan, rotation }` state + clamping. Transform math lives in the renderer. |
| `voxel.js` | Color palettes (`TERRAIN_COLORS`, `THEME_COLORS`), `shadeColor`, `terrainHeight`. |
| `piece-preview.js` | Draws a small voxel model of a track piece into a palette canvas. |
| `input.js` | `InputController`: unifies mouse + touch Pointer Events into `onTap` / `onPan` / `onZoom` / `onRotate`. |
| `audio.js` | `AudioView`: streams CC music + plays SFX files, with a synthesized fallback. Driven by `View.onEvent`. |
| `view-abstraction.js` | The `View` base class + `ViewEvent` enum — the presentation boundary. |

### UI (`src/ui/`) — screens

Every screen is a class with `mount(root)` and optional `dispose()` / `afterRender()` /
`onTap(x, y)`. The app swaps screens via `setScreen`.

Each view has its own URL via the History API (client-side routing in `app.js`):
`/` = menu, `/overworld`, `/stage/{levelId}`, `/editor`, `/settings`. The `show*`
methods push history through `_setURL` (no-op when the path is unchanged); `popstate`
and initial boot map the location back to a screen via `_routeFromLocation` /
`_applyRoute`. Deep links work because `index.html` sets `<base href="/">` (so relative
asset/`fetch` paths resolve from root) and `scripts/serve.mjs` falls back to `index.html`
for extension-less routes.

| Screen | File | Notes |
| --- | --- | --- |
| Menu | `menu.js` | Play/Continue, editor, settings. |
| Overworld | `overworld.js` | Rendered as a real game scene; each station = a level. HTML labels are positioned over station voxels and re-aligned in `afterRender()`. |
| Game | `game-screen.js` | The live arcade loop. 4 random piece slots, auto-fit placement, a floating rotate button, tap-a-switch-to-toggle, Escape→menu. |
| Editor | `editor.js` | Visual map editor: paint Track / Station / Terrain tiles onto the game map; "Save & Play" compiles the map into a level def, validates via `loadLevel`, then plays. |
| Settings | `settings.js` | Volume/mute sliders, persisted. |
| `dom.js` | — | Tiny `el()` / `button()` helpers (no framework). |

## Data flow

```
Pointer/touch ─▶ InputController ─▶ app handlers ─▶ Renderer camera (zoom/rotate/pan)
                                  └▶ currentScreen.onTap ─▶ GameModel editing API
GameModel ──getState()──▶ Renderer.render(snapshot)  (Canvas)
GameModel ──emit(event)──▶ AudioView.onEvent          (Web Audio)
GameModel ──getRunResult()──▶ app.recordResult ─▶ save.js ─▶ localStorage
```

The app (`src/app.js`) is the composition root: it loads the campaign manifest + levels,
constructs the renderer/audio/input, wires the model's event sink to audio, owns the
`SaveStore`, and routes between screens. It also exposes `window.TrainSetGo`, the **stable
test surface** the Playwright e2e suite drives (see below). Treat that object as a public
API — changing it can break e2e tests.

## Rendering & camera model

World space is computed by `hexToWorld(q, r)` (pointy-top axial → squished iso). The
on-screen transform is:

```
screen = origin + pan + Rotate(rotation) · world · zoom
```

where `origin = { x: viewW/2, y: viewH/3 }`. Two subtleties that have already caused bugs —
do not regress them:

1. **Focal zoom/rotate must account for `origin`.** `zoomAt`/`rotateAt` keep the world point
   under the gesture's focal point fixed by anchoring on `(s − origin − pan)/zoom`. A naive
   camera-only zoom ignores the origin and drifts.
2. **Painter's order sorts by projected screen-Y**, not raw `q,r`. Sorting by raw axial
   coordinates mis-layers pieces as soon as the camera rotates.

Canvas sizing uses a fixed logical size + DPR-scaled backing store. **Never** derive
`canvas.width` from `canvas.clientWidth` without pinning the CSS display size — it compounds
on every redraw and grows the element unbounded (this bit `piece-preview.js` once).

## Persistence

State is a single versioned JSON document in `localStorage` under `trainsetgo.save`
(`SCHEMA_VERSION = 1`). `save.js` `normalize()` prunes unknown level ids, clamps settings,
and always re-asserts the manifest's initially-unlocked levels, so a corrupt or stale save
degrades safely to a fresh state. Migrations are keyed on `schemaVersion` in `migrate()`.
Full schema: [`contracts/save-schema.md`](../specs/001-hex-train-puzzle/contracts/save-schema.md).

## Testing strategy

Three tiers, all single-line and non-interactive (constitution principle II):

| Tier | Command | What it covers |
| --- | --- | --- |
| Unit | `npm run test:unit` | Pure functions in `model/` (hex, track, unlock, save). |
| Model | `npm run test:model` | Headless `GameModel` scenarios: load a level, `step`/`runUntilComplete`, assert state. Uses a no-op test view. |
| E2E | `npm run test:e2e` | Playwright drives the real app via `window.TrainSetGo`. |

`npm test` runs all three. Because the model is deterministic, model tests reproduce
identical runs from a seed — prefer adding a model test over an e2e test whenever the
behavior can be expressed against `GameModel`.

## Invariants worth protecting

- `src/model/**` stays DOM-free and deterministic.
- Track connectivity has **one** definition (`track.js`); the renderer and piece-preview
  derive from it via `connectionPairs`. Don't reintroduce a local copy.
- `window.TrainSetGo` and `data-testid` attributes are a public contract for e2e tests.
- Editing the model returns a result object (`{ ok, reason }`) rather than throwing for
  expected rejections (locked tile, no track, etc.).
