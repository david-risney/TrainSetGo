---

description: "Task list for Hex Train Routing Puzzle Game implementation"
---

# Tasks: Hex Train Routing Puzzle Game

**Input**: Design documents from `/specs/001-hex-train-puzzle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED. The constitution mandates Spec/Test-Driven development and the spec's
clarifications require unit, game-model, and Playwright end-to-end tests. Test tasks are written
FIRST within each story and must FAIL before implementation.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing. Stories are in priority order: US1 (P1) → US2/US3/US4 (P2) →
US5/US6 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 maps to the user stories in spec.md
- Exact file paths are included in each task

## Path Conventions

Single static web project at repository root: `src/model/`, `src/view/`, `src/ui/`, `src/levels/`,
`src/assets/`, `tests/unit/`, `tests/model/`, `tests/e2e/`, `scripts/` (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project directory structure (`src/model`, `src/view`, `src/ui`, `src/levels`, `src/assets`, `tests/unit`, `tests/model/support`, `tests/e2e`, `scripts`) per plan.md
- [X] T002 Create `package.json` with dev/test scripts (`serve`, `test:unit`, `test:model`, `test:e2e`, `test`) and Playwright as the only devDependency; no runtime dependencies
- [X] T003 [P] Create `index.html` app shell that loads `src/app.js` as a native ES module
- [X] T004 [P] Create `styles.css` with a responsive base layout (CSS only, no framework)
- [X] T005 [P] Create `scripts/serve.mjs`, a dependency-free Node static file server
- [X] T006 [P] Create `playwright.config.js` configured headless with `webServer` launching `scripts/serve.mjs`
- [X] T007 Install tooling: run `npm install` and `npx playwright install`

**Checkpoint**: Project scaffolding builds and `npm test` runs (with zero tests yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core model primitives, the model/view boundary, and the rendering/input substrate that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. The `src/model/` files MUST remain DOM-free (FR-050).

- [X] T008 [P] Implement axial hex coordinates (neighbors, `edgeTo`, distance) in `src/model/hex.js`
- [X] T009 [P] Implement a seeded deterministic PRNG (e.g., mulberry32) in `src/model/rng.js`
- [X] T010 [P] Define enums/constants (TerrainType, TrackShape, LockState, TrainStatus, RunOutcome, ColorTheme) in `src/model/constants.js`
- [X] T011 Implement Tile and TrackPlacement, including shape+orientation → connected edges, crossing pairs, and switch branches, in `src/model/tile.js` and `src/model/track.js` (depends on T008, T010)
- [X] T012 Implement the Level loader and validation per `contracts/level-schema.md` in `src/model/level.js` (depends on T011)
- [X] T013 [P] Create the View Abstraction interface (`render`, `onEvent`, `setCamera`, `dispose`) in `src/view/view-abstraction.js` per `contracts/view-abstraction.md`
- [X] T014 [P] Create the test View implementation (records snapshots + event log) in `tests/model/support/test-view.js`
- [X] T015 Implement the GameModel skeleton (`loadLevel`, working grid, `tick` counter, `getState` snapshot) in `src/model/simulation.js` (depends on T011, T012)
- [X] T016 [P] Create a sample level fixture `src/levels/level-a.json` and `src/levels/campaign.json` per `contracts/level-schema.md`
- [X] T017 Implement the Canvas 2D isometric renderer + camera substrate (hex→iso projection, zoom/pan transform) in `src/view/renderer.js` and `src/view/camera.js` (depends on T008)
- [X] T018 [P] Implement voxel-model → isometric sprite baking and cache in `src/view/voxel.js`
- [X] T019 Implement the Pointer Events input substrate (tap/drag/pinch → semantic commands) in `src/view/input.js`
- [X] T020 Implement app bootstrap + screen router (menu/overworld/game/editor) in `src/app.js` (depends on T013, T017, T019)
- [X] T021 Implement `localStorage` load/persist base with `schemaVersion` per `contracts/save-schema.md` in `src/model/save.js`

**Checkpoint**: Foundation ready — model is steppable/headless-testable and the app shell renders. User stories can now begin.

---

## Phase 3: User Story 1 - Solve a level by routing trains (Priority: P1) 🎯 MVP

**Goal**: Place/rotate track on editable tiles to route color-matched trains to matching stations, run the simulation, and get a cleared/failed outcome per the exit requirement.

**Independent Test**: Load `level-a`, place/rotate track to connect a source and destination station, start the run, and confirm the matching train arrives (`completed`) and the level reports `cleared` when the exit requirement is met.

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T022 [P] [US1] Unit tests for track connectivity and rotation in `tests/unit/track.test.js`
- [X] T023 [P] [US1] Unit tests for hex adjacency/coordinates in `tests/unit/hex.test.js`
- [X] T024 [P] [US1] Game-model test: complete path → train `completed` and level `cleared` in `tests/model/core-loop.test.js`
- [X] T025 [P] [US1] Game-model test: end-of-track crash → `lost`; wrong-color station arrival → `lost` in `tests/model/lost.test.js`
- [X] T026 [P] [US1] Game-model test: two trains on same tile / position swap → both `lost` in `tests/model/collision.test.js`
- [X] T027 [P] [US1] Game-model test: exit requirement → `cleared`/`failed` and exact completion percentage (required trains only) in `tests/model/exit-requirement.test.js`
- [X] T028 [P] [US1] Game-model determinism test: same seed + scripted input → identical state every tick in `tests/model/determinism.test.js`
- [X] T029 [P] [US1] E2E: place/rotate track, run, level cleared in `tests/e2e/core-loop.spec.js`

### Implementation for User Story 1

- [X] T030 [US1] Implement editing API `placeTrack`/`rotateTrack`/`removeTrack` with lock enforcement (reject on locked tiles, editing only when not running) in `src/model/simulation.js` (depends on T015)
- [X] T031 [US1] Implement `startRun` and fixed-step `step()`: depart trains after `startDelay`, move running trains one tile along connections, track `headingEdge` in `src/model/simulation.js`
- [X] T032 [US1] Implement outcome classification: correct-color destination → `completed`; end-of-track → `lost`; wrong-color station → `lost` in `src/model/simulation.js`
- [X] T033 [US1] Implement train-train collision (same tile and edge-swap) → both `lost` in `src/model/simulation.js`
- [X] T034 [US1] Implement `isRunComplete`, completion-percentage helper (required trains only), and `getRunResult` (deliveredTrainIds, outcome vs exit requirement) in `src/model/simulation.js` and `src/model/unlock.js`
- [X] T035 [US1] Implement the game screen (tool palette, place/rotate/remove, Run button, edits disabled during run) in `src/ui/game-screen.js` (depends on T020, T030)
- [X] T036 [US1] Render tiles/track/stations and animate train movement through the renderer in `src/view/renderer.js` and `src/ui/game-screen.js`
- [X] T037 [US1] Wire pointer input (tap to place/rotate/remove) to model edits in `src/view/input.js` and `src/ui/game-screen.js`

**Checkpoint**: Core gameplay loop is fully functional and independently testable — MVP.

---

## Phase 4: User Story 2 - Navigate the overworld and unlock levels (Priority: P2)

**Goal**: Select levels from a hex-grid overworld and unlock subsequent levels based on completion thresholds and specific-train conditions.

**Independent Test**: With a 2-level map where `level-a` declares "70%→level-b, 100%→level-a-special", complete `level-a` at 100% and confirm both become selectable.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T038 [P] [US2] Unit tests for unlock-rule evaluation (percentage thresholds, named-train conditions, multiple rules) in `tests/unit/unlock.test.js`
- [X] T039 [P] [US2] E2E: 100% completion unlocks both B and A-Special; below threshold leaves the gated level locked in `tests/e2e/unlock.spec.js`

### Implementation for User Story 2

- [X] T040 [US2] Implement unlock-rule evaluation (`minCompletionPct` AND `requiredTrainIds`) → unlocked level ids in `src/model/unlock.js`
- [X] T041 [US2] Apply unlock results to `unlockedLevelIds` on run completion in `src/app.js` and `src/model/save.js`
- [X] T042 [US2] Implement the overworld hex-grid screen with per-level placement and locked/unlocked status in `src/ui/overworld.js` (depends on T017, T020)
- [X] T043 [US2] Enforce selection rules (unlocked → loads level; locked → rejected) in `src/ui/overworld.js`
- [X] T044 [US2] Wire the campaign manifest and `initialUnlocked` into the overworld in `src/levels/campaign.json` and `src/model/level.js`

**Checkpoint**: Overworld navigation and progression work; US1 still passes independently.

---

## Phase 5: User Story 3 - Persist progress with auto save/load (Priority: P2)

**Goal**: Automatically save and restore unlocked levels, best results, in-progress layout, and settings.

**Independent Test**: Unlock a level and partially place tiles, reload, and confirm unlocked levels and in-progress layout are restored.

### Tests for User Story 3 (write first, must FAIL) ⚠️

- [X] T045 [P] [US3] Unit tests for save serialization, best-result update, and migration/fallback in `tests/unit/save.test.js`
- [X] T046 [P] [US3] E2E: unlock a level + place tiles, reload, state restored in `tests/e2e/persistence.spec.js`

### Implementation for User Story 3

- [X] T047 [US3] Implement auto-save triggers (unlock, result recorded, layout edit, settings change) in `src/model/save.js` and `src/app.js`
- [X] T048 [US3] Implement restore-on-startup and fresh-state init from the campaign manifest in `src/model/save.js` and `src/app.js`
- [X] T049 [US3] Implement in-progress layout save/restore (tilePlacements, switchStates) in `src/model/save.js` and `src/ui/game-screen.js`
- [X] T050 [US3] Implement best-result update rule (replace only when strictly better) in `src/model/save.js`
- [X] T051 [US3] Implement schema migration + safe fallback (missing/changed level drops `inProgress`, preserves unlock progress) in `src/model/save.js`

**Checkpoint**: Persistence works across reloads; US1–US2 still pass independently.

---

## Phase 6: User Story 4 - Operate switches to direct trains (Priority: P2)

**Goal**: Toggle switch tiles to route trains down selectable branches; crossings let tracks pass through without merging.

**Independent Test**: Build a switch splitting one inbound track toward two differently colored stations; toggle the switch and confirm the train follows the selected branch each time.

### Tests for User Story 4 (write first, must FAIL) ⚠️

- [X] T052 [P] [US4] Game-model test: switch routes train to active branch; toggling changes the branch in `tests/model/switch.test.js`
- [X] T053 [P] [US4] Game-model test: crossing passes both tracks through without merging in `tests/model/crossing.test.js`
- [X] T054 [P] [US4] E2E: toggling a switch routes the train to a different station in `tests/e2e/switch.spec.js`

### Implementation for User Story 4

- [X] T055 [US4] Implement switch shape branches and `toggleSwitch` (cycle active branch) in `src/model/track.js` and `src/model/simulation.js`
- [X] T056 [US4] Implement routing through a switch (train exits the active branch; switch set against the train → end-of-track `lost`) in `src/model/simulation.js`
- [X] T057 [US4] Implement crossing pass-through (two independent connection pairs) in `src/model/track.js` and `src/model/simulation.js`
- [X] T058 [US4] Implement switch toggle UI and during-run toggle per level configuration in `src/ui/game-screen.js` and `src/view/input.js`
- [X] T059 [US4] Render the active-branch indicator for switches in `src/view/renderer.js`

**Checkpoint**: Switch/crossing puzzles work; US1–US3 still pass independently.

---

## Phase 7: User Story 5 - Create and edit levels in the level editor (Priority: P3)

**Goal**: Author levels (terrain/lock states, stations with color, trains, exit requirement, unlock rules), save them, and play them.

**Independent Test**: Author a minimal level (one source, one destination, one train, an exit requirement) in the editor, save, then load and play it to completion.

### Tests for User Story 5 (write first, must FAIL) ⚠️

- [X] T060 [P] [US5] E2E: author a minimal level, save, play to a successful completion in `tests/e2e/editor.spec.js`
- [X] T061 [P] [US5] Model test: editor-produced JSON loads and validates identically to the authored layout in `tests/model/editor-roundtrip.test.js`

### Implementation for User Story 5

- [X] T062 [US5] Implement the editor screen: place terrain and lock states / editable grass in `src/ui/editor.js` (depends on T020)
- [X] T063 [US5] Implement station placement with color-theme assignment in `src/ui/editor.js`
- [X] T064 [US5] Implement train definition (color, source, destination, startDelay, required/optional) in `src/ui/editor.js`
- [X] T065 [US5] Implement exit-requirement and unlock-rule authoring in `src/ui/editor.js`
- [X] T066 [US5] Implement save/load of level JSON (export/import) per `contracts/level-schema.md` in `src/ui/editor.js` and `src/model/level.js`
- [X] T067 [US5] Wire "play authored level" from the editor into the game screen in `src/app.js`

**Checkpoint**: Editor round-trip works; US1–US4 still pass independently.

---

## Phase 8: User Story 6 - Experience audio and 3D presentation (Priority: P3)

**Goal**: Isometric voxel rendering of all entities with zoom/pan, a main menu, background music + sound effects, and persisted audio settings.

**Independent Test**: Launch the game, confirm the main menu appears, enter a level, zoom/pan over the voxel scene, and confirm music plays and a sound effect triggers on a train event.

### Tests for User Story 6 (write first, must FAIL) ⚠️

- [X] T068 [P] [US6] E2E: main menu present; zoom/pan works; an sfx event fires on a train event (assert View `onEvent` calls) in `tests/e2e/presentation.spec.js`
- [X] T069 [P] [US6] E2E: settings volume/mute persist across reload in `tests/e2e/settings.spec.js`

### Implementation for User Story 6

- [X] T070 [P] [US6] Author voxel models (terrain types, track shapes, trains, stations, decorations) as JSON in `src/assets/`
- [X] T071 [US6] Implement isometric voxel rendering of all model types with depth sorting in `src/view/renderer.js` and `src/view/voxel.js`
- [X] T072 [US6] Implement zoom/pan camera controls (wheel/pinch + drag) responding within 100 ms in `src/view/camera.js` and `src/view/input.js`
- [X] T073 [US6] Implement `audio.js`: background music + sound effects on depart/arrive/crash/UI via View `onEvent` in `src/view/audio.js`
- [X] T074 [US6] Implement the main menu (start/continue, open editor, settings) in `src/ui/menu.js`
- [X] T075 [US6] Implement the settings screen (music/sfx volume + mute, persisted) in `src/ui/settings.js` and `src/model/save.js`

**Checkpoint**: Full presentation and audio; all stories pass independently.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality affecting multiple stories

- [X] T076 [P] Implement responsive layout and ≥44×44 CSS px touch targets across all screens (360 px → desktop, portrait/landscape) in `styles.css`
- [X] T077 [P] E2E: mobile viewport — touch place/rotate, pinch-zoom, no horizontal scroll or forced rotation in `tests/e2e/responsive.spec.js`
- [X] T078 [P] Update `README.md` run/play docs and reconcile with `specs/001-hex-train-puzzle/quickstart.md`
- [X] T079 Performance pass: sprite caching, 60 fps render check, verify camera input latency < 100 ms
- [X] T080 Run full `quickstart.md` validation (`npm test` green across unit, model, and e2e)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational completion
  - US1 (P1) first as MVP; US2/US3/US4 (P2) next; US5/US6 (P3) last
  - After Foundational, stories can proceed in parallel if staffed (mind shared-file notes below)
- **Polish (Phase 9)**: Depends on the targeted user stories being complete

### User Story Dependencies

- **US1 (P1)**: Only Foundational. No dependency on other stories.
- **US2 (P2)**: Foundational. Consumes `getRunResult` from US1 for unlock evaluation but is independently testable with a stub result.
- **US3 (P2)**: Foundational. Persists state produced by US1/US2 but is independently testable via `save.js` units.
- **US4 (P2)**: Foundational + US1 simulation loop (extends `step()`/routing).
- **US5 (P3)**: Foundational. Reuses US1 game screen to play authored levels.
- **US6 (P3)**: Foundational. Layers presentation/audio over the existing loop.

### Within Each User Story

- Tests are written FIRST and MUST FAIL before implementation
- Model logic before UI/rendering; core implementation before integration
- Complete a story (and its checkpoint) before starting the next priority

### Shared-file notes (avoid conflicts)

- `src/model/simulation.js` is touched by US1 and US4 — sequence US4's `step()` changes after US1.
- `src/model/save.js` is touched in Foundational (T021) and US3 — US3 extends the base.
- `src/view/renderer.js` is touched by US1, US4, and US6 — coordinate or sequence these edits.

### Parallel Opportunities

- All `[P]` Setup tasks (T003–T006) can run together.
- All `[P]` Foundational primitives (T008, T009, T010, T013, T014, T016, T018) can run together.
- All test tasks within a story marked `[P]` can run together (they create separate files).
- With a team, after Foundational: US2, US3, and US5 can largely proceed in parallel; US4 and US6 should coordinate on `simulation.js`/`renderer.js`.

---

## Parallel Example: User Story 1 tests

```bash
# Author all US1 tests together (separate files), then watch them fail:
Task: "Unit tests for track connectivity in tests/unit/track.test.js"
Task: "Unit tests for hex adjacency in tests/unit/hex.test.js"
Task: "Game-model core-loop test in tests/model/core-loop.test.js"
Task: "Game-model lost-train test in tests/model/lost.test.js"
Task: "Game-model collision test in tests/model/collision.test.js"
Task: "Game-model exit-requirement test in tests/model/exit-requirement.test.js"
Task: "Game-model determinism test in tests/model/determinism.test.js"
Task: "E2E core-loop test in tests/e2e/core-loop.spec.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (tests first, then implementation)
4. **STOP and VALIDATE**: `npm run test:unit && npm run test:model && npm run test:e2e` green for the core loop
5. Demo the MVP (build a path, run trains, clear a level)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → demo (MVP)
3. US2 (overworld/unlock) → US3 (persistence) → US4 (switches) → validate each
4. US5 (editor) → US6 (presentation/audio) → validate each
5. Polish (responsive/touch, performance, full quickstart) → ship

### Parallel Team Strategy

1. Whole team completes Setup + Foundational
2. Then: Dev A → US1; once US1's simulation lands, Dev B → US4; Dev C → US2/US3; Dev D → US5; Dev E → US6
3. Coordinate edits to `simulation.js`, `save.js`, and `renderer.js` per the shared-file notes

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks
- `[Story]` label maps each task to a user story for traceability
- Keep `src/model/` DOM-free — it is imported directly by `node:test` game-model tests
- All test commands are single-line and headless (constitution: Copilot Automated Harness)
- Verify each test fails before implementing; commit after each task or logical group
- Stop at any checkpoint to validate a story independently
