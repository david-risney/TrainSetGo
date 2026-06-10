# Implementation Plan: Hex Train Routing Puzzle Game

**Branch**: `001-hex-train-puzzle` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-hex-train-puzzle/spec.md`

## Summary

A client-side, static web puzzle game where players place and rotate hexagonal track
tiles and toggle switches to route color-matched trains from source stations to matching
destination stations across hand-authored or editor-created levels, with an overworld for
level selection/progression and auto save/load. The scene is presented as an isometric
voxel view with zoom and pan, on desktop (mouse/keyboard) and mobile (touch).

Technical approach: vanilla JavaScript (ES2022 modules), no frameworks, served as static
files. A deterministic, DOM-free **game model** (fixed-step, seeded simulation) is strictly
separated from a **view/presentation** layer behind a small View Abstraction so the model can
be instantiated and stepped headlessly. Rendering uses the Canvas 2D API to composite
isometric voxel sprites (fixed isometric angle, zoom/pan only — no free rotation). Persistence
uses `localStorage` with versioned JSON. Input uses the Pointer Events API to unify mouse and
touch. Testing has three layers, all runnable non-interactively: unit and game-model tests via
the Node built-in test runner (`node --test`, headless, no browser), and end-to-end tests via
Playwright driving a real browser.

## Technical Context

**Language/Version**: JavaScript ES2022, delivered as native browser ES modules. Node.js 20+
used only for tooling and tests (not shipped).

**Primary Dependencies**: None at runtime — vanilla HTML/CSS/JS using browser APIs (Canvas 2D,
Pointer Events, Web Audio, `localStorage`). Dev/test only: Playwright (end-to-end). Unit and
game-model tests use Node's built-in `node:test` runner (no dependency). No UI framework (React/
Vue/Angular), no CSS framework (Tailwind/Bootstrap), no 3D engine (Three.js).

**Storage**: Browser `localStorage`, JSON-serialized, schema-versioned with safe fallback when a
referenced level definition is missing or changed (per spec edge cases). Level definitions are
JSON assets.

**Testing**: `node:test` for unit tests (pure logic) and game-model/simulation tests (load a
level/state, inject scripted input, run N ticks via a test view, assert game state); Playwright
for browser end-to-end tests. All layers run headlessly via single-line commands with pass/fail
exit codes.

**Target Platform**: Evergreen browsers (latest Chrome, Firefox, Safari, Edge) on desktop and
mobile; responsive from ~360 CSS px wide to large desktop displays, portrait and landscape.

**Project Type**: Static single-page web application (no server-side runtime).

**Performance Goals**: 60 fps rendering target during play; camera responds to zoom/pan input
within 100 ms (SC-006); deterministic fixed-step simulation (identical results for identical
inputs + seed, SC-012).

**Constraints**: Fully client-side and offline-capable; deployable as static files; no frameworks
(constitution); model layer must have zero DOM/browser dependencies; touch targets ≥ 44×44 CSS px;
no horizontal scroll or forced rotation on supported screens.

**Scale/Scope**: Single local player; an initial campaign of dozens of levels; hex grids on the
order of tens to a few hundred tiles per level; a handful of trains active per level.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0 — three principles plus the Technology Stack section.

| Principle | Gate | Status |
|-----------|------|--------|
| I. Spec/Test Driven | Tests precede implementation; acceptance scenarios are testable Given/When/Then; every feature has spec + tests first | PASS — spec with testable scenarios exists; plan defines unit/game-model/E2E layers authored test-first (see tasks phase). |
| II. Copilot Automated Harness | Build/lint/test expressible as single-line, non-interactive commands; deterministic harness; agent-runnable | PASS — `node --test` and `npx playwright test` are single-line, headless, deterministic; model is steppable and seedable. |
| III. Fun | Technical decisions defer to player enjoyment | PASS — core loop (place/route/run) prioritized as P1; presentation isometric voxel with smooth zoom/pan; nothing in the stack compromises gameplay feel. |
| Technology Stack | Static web only; plain HTML/CSS/JS; modern browser APIs; NO frameworks; NO utility CSS; evergreen browsers; no server runtime | PASS — vanilla ES modules, Canvas 2D, no frameworks/CSS frameworks/3D engine. Node + Playwright are dev/test tooling only and are NOT part of the static deployable artifact, so the shipped game remains static-web-only. |

**Initial gate: PASS.** No violations → Complexity Tracking left empty.

**Post-design re-check (after Phase 1): PASS.** The data model, contracts, and quickstart keep the
model DOM-free, name no runtime frameworks, and preserve single-line non-interactive test commands.
No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-hex-train-puzzle/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── level-schema.md       # Level definition JSON contract
│   ├── save-schema.md        # Save/game-state JSON contract
│   ├── simulation-api.md     # Game model (deterministic simulation) contract
│   └── view-abstraction.md   # View Abstraction interface (real + test views)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
index.html                 # App shell; loads ES module entry
styles.css                 # Responsive layout, no CSS framework
package.json               # Dev/test scripts only (node --test, playwright); no runtime deps
playwright.config.js       # E2E config; launches static server via webServer

src/
├── app.js                 # Wires model + view + UI screens; app bootstrap
├── model/                 # Deterministic, DOM-free game model (Principle I/II, FR-050)
│   ├── hex.js             # Hex coordinates, adjacency, neighbors
│   ├── tile.js            # Tile + lock state
│   ├── track.js           # Track shapes, orientation, connectivity, switches
│   ├── train.js           # Train state + movement
│   ├── simulation.js      # Fixed-step tick engine, collisions, completion outcome
│   ├── level.js           # Level load/validate from JSON
│   ├── unlock.js          # Unlock-rule evaluation, completion percentage
│   ├── save.js            # Save/load serialization + schema migration
│   └── rng.js             # Seeded PRNG (deterministic)
├── view/                  # Presentation: rendering, audio, input (browser-only)
│   ├── view-abstraction.js# Interface contract shared with test view
│   ├── renderer.js        # Canvas 2D isometric compositor
│   ├── voxel.js           # Voxel model → isometric sprite baking + cache
│   ├── camera.js          # Zoom/pan transforms
│   ├── audio.js           # Web Audio SFX + music, volume/mute
│   └── input.js           # Pointer Events → model input (tap/drag/pinch), keyboard
├── ui/                    # Screens
│   ├── menu.js            # Main menu
│   ├── overworld.js       # Hex-grid level select
│   ├── game-screen.js     # In-level play
│   ├── editor.js          # Level editor
│   └── settings.js        # Audio/settings
├── levels/                # Built-in level definitions (JSON) + campaign manifest
└── assets/                # Voxel models (JSON), audio files

tests/
├── unit/                  # Pure logic unit tests (node:test)
├── model/                 # Game-model tests: load level, scripted input, run N ticks, assert
│   └── support/test-view.js   # Test-controlled View Abstraction implementation
└── e2e/                   # Playwright browser tests

scripts/
└── serve.mjs              # Minimal dependency-free static server (used by Playwright webServer)
```

**Structure Decision**: Single static web project (web-app variant) with a hard split between
`src/model/` (deterministic, importable in Node, zero DOM) and `src/view/` + `src/ui/`
(browser-only). This split is the backbone of the testing strategy: game-model tests import
`src/model/` directly under `node:test` and observe state via a test implementation of the View
Abstraction, while Playwright exercises the assembled app in a browser.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
