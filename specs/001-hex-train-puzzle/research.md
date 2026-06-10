# Phase 0 Research: Hex Train Routing Puzzle Game

All decisions respect the project constitution (v1.0.0): static web only, plain HTML/CSS/JS,
modern browser APIs, no frameworks, no utility CSS, no server runtime; Spec/Test-Driven and
Copilot-automated, non-interactive harness.

## R1. Runtime language & module system

- **Decision**: Vanilla JavaScript (ES2022) using native browser ES modules (`<script type="module">`),
  served as static files. No bundler/transpiler required for runtime.
- **Rationale**: Constitution mandates plain JS with modern browser APIs and forbids frameworks.
  Native ES modules give clean file separation (essential for the model/view split) with zero
  build step, keeping the deployable purely static.
- **Alternatives considered**: TypeScript (rejected — constitution lists it as opt-in only via a
  future amendment, and it adds a build step); a bundler like Vite/webpack (rejected — adds
  framework-like tooling and a build artifact; not needed for ES modules).

## R2. Isometric voxel rendering approach

- **Decision**: Render with the **Canvas 2D API**, compositing voxel models as isometric sprites.
  Voxel models are baked to cached sprite images at load; the scene is drawn per frame as
  depth-sorted sprites positioned by hex coordinate, with a single camera transform for zoom/pan.
- **Rationale**: The spec requires a *fixed* isometric angle with only zoom and pan (no free
  rotation). A fixed projection means full 3D is unnecessary — 2D isometric compositing is
  sufficient, far simpler, easy to keep at 60 fps via sprite caching, and uses only a core browser
  API (no engine). This best honors the "no frameworks / plain browser APIs" principle while
  keeping the renderer thin behind the View Abstraction.
- **Alternatives considered**:
  - **Three.js / Babylon.js** (rejected — third-party 3D engine; conflicts with the no-frameworks
    principle and adds heavy weight for a fixed-angle scene).
  - **Raw WebGL2** (rejected for v1 — a legitimate browser API, but voxel meshing, depth, and
    lighting are high-effort; documented as a future upgrade path if visual fidelity demands it).
  - **DOM/SVG isometric** (rejected — poor performance with many voxels and animated trains).

## R3. Voxel model format

- **Decision**: A lightweight internal JSON voxel format — a 3D array (or sparse list) of
  palette-indexed colored voxels per model (terrain, track pieces, trains, stations, decorations).
  At load, each model is baked into one or more isometric sprites and cached.
- **Rationale**: Keeps assets data-driven, editable, and diffable; baking to sprites decouples
  authoring cost from per-frame cost. No external file-format dependency.
- **Alternatives considered**: MagicaVoxel `.vox` binary import (rejected as a hard dependency, but
  a `.vox`→internal-JSON conversion may feed authoring later); per-model PNG sprites only (rejected
  — loses the voxel data needed for recoloring trains/stations by color theme at runtime).

## R4. Deterministic simulation

- **Decision**: A fixed-step, tick-based simulation. The model advances exactly one discrete tick
  per `step()` call. Any randomness comes from a seeded PRNG (`rng.js`, e.g. mulberry32); the model
  never reads wall-clock time or `Math.random` directly.
- **Rationale**: FR-048/049 and SC-012 require identical results for identical initial state +
  scripted input + seed, and individually steppable ticks for assertions. Fixed-step + seeded PRNG
  is the standard, test-friendly approach and makes game-model tests trivially reproducible.
- **Alternatives considered**: Real-time variable delta-time updates (rejected for the model —
  nondeterministic and hard to assert; the *view* may interpolate visually between ticks, but the
  authoritative model stays fixed-step).

## R5. Model / view separation

- **Decision**: `src/model/` contains only deterministic logic with **zero** DOM/browser imports,
  importable directly under Node. The presentation layer depends on a `View Abstraction` interface
  (`src/view/view-abstraction.js`). Production code wires the model to the Canvas renderer; tests
  wire the same model to a test view (`tests/model/support/test-view.js`) that records state for
  assertions.
- **Rationale**: FR-050/052 require headless instantiation/stepping with injected input and an
  observable view. A clean port/adapter boundary is what lets `node:test` run game-model tests with
  no browser, satisfying the constitution's automated-harness principle.
- **Alternatives considered**: jsdom to fake the DOM in model tests (rejected — heavier dependency
  and slower; unnecessary once the model is DOM-free).

## R6. Persistence

- **Decision**: `localStorage` holding a single versioned JSON document for game state (unlocked
  levels, best per-level results, in-progress level layout, settings). `save.js` validates the
  `schemaVersion` and migrates or safely falls back when a referenced level is missing/changed.
- **Rationale**: Spec requires local, per-browser, offline persistence with auto save/load and a
  safe-fallback edge case. `localStorage` is synchronous, simple, and sufficient for this data
  volume; versioning covers level-definition drift.
- **Alternatives considered**: IndexedDB (rejected for v1 — async complexity not justified at this
  data size; revisit if saves grow large, e.g. many custom editor levels).

## R7. Unified input (desktop + mobile)

- **Decision**: Use the **Pointer Events API** as the single input path: tap to place/rotate/toggle,
  one-pointer drag to pan, two-pointer pinch to zoom; keyboard shortcuts add desktop conveniences.
  `input.js` translates gestures into model input commands.
- **Rationale**: Pointer Events unify mouse, touch, and pen in one code path (FR-044/045), reducing
  branching and matching the clarified touch mapping. Keeps the model input-device-agnostic (input
  is injected as semantic commands).
- **Alternatives considered**: Separate mouse + touch event handlers (rejected — duplicated logic,
  drift risk); a gesture library (rejected — added dependency/framework).

## R8. Responsive layout

- **Decision**: Plain CSS with fluid canvas sizing (canvas fills its container; internal resolution
  scaled by `devicePixelRatio`), CSS media/container queries for control layout, and ≥ 44×44 CSS px
  touch targets. No CSS framework.
- **Rationale**: FR-046/047 require responsiveness from ~360 px to large desktops, both orientations,
  with no horizontal scroll/forced rotation. Modern CSS handles this without utility frameworks
  (which the constitution forbids).
- **Alternatives considered**: Tailwind/Bootstrap (rejected — constitution forbids utility/CSS
  frameworks).

## R9. Audio

- **Decision**: **Web Audio API** for short, low-latency sound effects (departure, arrival, crash,
  UI), and a looping `HTMLAudioElement` (or Web Audio buffer source) for background music. Volume and
  mute are stored in settings and applied via gain.
- **Rationale**: FR-042/043 and SC-009; Web Audio gives precise, low-latency SFX timing tied to
  simulation events; persisted gain satisfies the volume/mute persistence requirement.
- **Alternatives considered**: `HTMLAudioElement` for everything (rejected for SFX — higher latency,
  limited concurrent playback).

## R10. Level definition format & editor

- **Decision**: Levels are JSON documents (grid + per-tile lock state, stations with color, trains
  with delay/required-flag/name, exit requirement, unlock rules) plus a campaign manifest listing
  initially-unlocked levels. The editor reads and writes this same JSON, with import/export.
- **Rationale**: FR-019 and FR-033–FR-038; a single shared format means the editor and the game load
  the exact same definition (SC-005), and JSON is human-diffable and test-fixture friendly.
- **Alternatives considered**: A bespoke binary or DSL format (rejected — harder to test, author, and
  diff with no real benefit at this scale).

## R11. Test stack & non-interactive harness

- **Decision**:
  - Unit + game-model tests: Node's built-in **`node:test`** runner, executed via `node --test`.
    Game-model tests import `src/model/` and the test view.
  - End-to-end tests: **Playwright** (`npx playwright test`), headless, with `playwright.config.js`
    using `webServer` to launch `scripts/serve.mjs` (a dependency-free static server).
  - All commands are single-line, non-interactive, and return pass/fail exit codes.
- **Rationale**: FR-053–FR-056 and the constitution's automated-harness principle. `node:test` adds
  zero dependency and is fully headless; Playwright is the user-mandated browser E2E tool. A tiny
  Node static server avoids an extra runtime dependency for serving the static game during E2E.
- **Alternatives considered**: Jest/Vitest/Mocha (rejected — extra dependencies vs. the built-in
  runner that already covers needs); serving via `npx serve`/`http-server` (rejected — extra dep;
  a ~30-line `serve.mjs` suffices and is itself testable).

## R12. Hex grid coordinate system

- **Decision**: Use **axial/cube hex coordinates** with a standard layout (e.g., pointy-top), with
  conversion helpers to isometric screen space in the renderer/camera only.
- **Rationale**: Axial/cube coordinates make adjacency, neighbor lookup, and track-endpoint matching
  (6 edges) clean and well-understood; keeping screen projection out of the model preserves the
  DOM-free boundary.
- **Alternatives considered**: Offset (row/col) coordinates (rejected — messier neighbor math and
  parity special-casing).

## Open questions

None. All Technical Context items are resolved; no `NEEDS CLARIFICATION` remain.
