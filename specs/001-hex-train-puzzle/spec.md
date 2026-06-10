# Feature Specification: Hex Train Routing Puzzle Game

**Feature Branch**: `001-hex-train-puzzle`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "This project is a web based game. There is a game menu, level editor, music, sound effects, auto save/load game state. In game is a hex tile grid, the player places tiles with different track shapes (straight, slight curve, sharp curve, switch, crossing), rotates tiles, toggle switches in an effort to get trains to their target train stations (trains matching color themes with train station color theme). Levels come with an initial game state including the tiles and which tiles are locked - meaning the player cannot place tiles there - train stations, forrest, lake, mountain, mountain tunnel, mountain tunnel interrior tracks are locked and the player cannot place. But other tiles are unlocked plain grass and can be placed. Levels describe trains starting after some delay with a source station position and destination station position. If trains hit the end of track or run into another train they crash, or if they reach the wrong station the train is lost. Levels have exit requiremnets (% of trains must not be lost). There is an overworld to select levels that is the same hex grid as in game. Levels unlock different subsequent levels depending on completion (eg level A can specify 70% unlocks level B and 100% unlocks level A-Special). Level's trains can be required or optional optional. Specific train completion can be used for unlock specific levels. Levels describe exit conditions for unlocking other levels. The UI is implemented as isometric 3D graphcis with zoom and pan. The tiles are hexagons, but the terrain, track, trains, decorations, train stations and so on are voxel models."

## Clarifications

### Session 2026-06-09

- Q: Which platforms must the game support for input and screen size? → A: Both desktop and mobile — mouse/keyboard on desktop and touch on mobile, with a responsive layout adapting to both large and small screens.
- Q: Mobile screen orientation support? → A: Both portrait and landscape; layout adapts responsively to either (no forced rotation).
- Q: How do core actions map to touch input on mobile? → A: Tap a tool/grass tile to place track; tap a placed editable tile to rotate it; tap a switch to toggle it; one-finger drag to pan; two-finger pinch to zoom. Desktop retains mouse/keyboard equivalents.
- Q: Minimum/target screen size range to support? → A: Phones from ~360 CSS px wide up through large desktop displays; UI controls remain usable (touch targets ≥ 44 CSS px on touch devices).
- Q: What testing layers are required? → A: Three layers — (1) unit tests for pure logic, (2) game-model/simulation tests that load a level or game state, run a controlled number of simulation steps with test-controlled input and a test-controlled (headless) view, and assert on game state, and (3) end-to-end tests using Playwright running the actual game in a browser.
- Q: Must the game simulation be deterministic for testing? → A: Yes — given the same initial game state, scripted inputs, and seed, the simulation MUST produce identical results across runs, with simulation advanced in discrete, individually steppable ticks.
- Q: How must the model be structured for game-model tests? → A: The simulation/game model MUST be decoupled from rendering, audio, and input devices so it can be instantiated and stepped headlessly, with inputs injected programmatically and state observed via a test-controlled view abstraction (no real canvas/DOM required).
- Q: How must the test harness be runnable? → A: All test layers MUST be runnable non-interactively as single-line commands (headless, no manual intervention) suitable for Copilot/CI automation, returning a clear pass/fail exit status.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Solve a level by routing trains (Priority: P1)

A player opens a level, studies the hex grid showing pre-placed locked terrain (stations, forest, lake, mountains, tunnels) and editable grass tiles. The player places and rotates track tiles on grass tiles to build a connected path from each train's source station to its correct destination station, then starts the simulation and watches color-matched trains travel to their matching-colored stations. The level is cleared when the exit requirement (percentage of trains not lost) is met.

**Why this priority**: This is the core gameplay loop. Without the ability to place track, run trains, and evaluate success against a level's exit requirement, there is no game. It alone constitutes a playable MVP.

**Independent Test**: Load a single hand-authored level, place/rotate track tiles to connect a source and destination station, start the run, and confirm a color-matched train reaches its matching station and the level reports success when the exit requirement is satisfied.

**Acceptance Scenarios**:

1. **Given** a level with a grass tile between a connected track path and a destination station, **When** the player places a straight track tile on that grass tile completing the path, **Then** the gap is bridged and the tile visually connects to its neighbors.
2. **Given** a placed track tile, **When** the player rotates it, **Then** the tile's track endpoints rotate to the next hex orientation and connections to neighbors update accordingly.
3. **Given** a locked tile (station, forest, lake, mountain, tunnel, or tunnel interior), **When** the player attempts to place or modify track on it, **Then** the action is rejected and the tile remains unchanged.
4. **Given** a complete valid path from a red train's source station to a red destination station, **When** the player starts the run, **Then** the red train departs after its configured delay and arrives at the red station, counting as completed.
5. **Given** a train traveling toward a destination, **When** it reaches the end of a track with no continuation, **Then** the train crashes and is counted as lost.
6. **Given** two trains on a converging path, **When** they occupy the same tile at the same time, **Then** both trains crash and are counted as lost.
7. **Given** a train arriving at a station whose color does not match the train, **When** it enters that station, **Then** the train is counted as lost (wrong destination).
8. **Given** a level with an exit requirement of "at least 70% of required trains not lost", **When** the run ends with 80% of required trains delivered correctly, **Then** the level is marked cleared.
9. **Given** a level with an exit requirement, **When** the run ends with fewer trains delivered than required, **Then** the level is marked failed and the player may retry.

---

### User Story 2 - Navigate the overworld and unlock levels (Priority: P2)

A player views an overworld rendered as a hex grid (the same style as in-game), selects an available level, plays it, and—based on how well they performed—unlocks subsequent levels. Different completion thresholds unlock different branches (e.g., 70% completion unlocks the next standard level, 100% completion unlocks a special bonus level), and completion of specific named trains can unlock specific levels.

**Why this priority**: Progression and level selection give the game structure and replay incentive, but they depend on the core solving loop (P1) existing first.

**Independent Test**: With a small map of two levels where Level A defines "70% unlocks Level B, 100% unlocks Level A-Special", complete Level A at 100% and confirm both Level B and Level A-Special become selectable in the overworld.

**Acceptance Scenarios**:

1. **Given** an overworld with locked and unlocked levels, **When** the player selects an unlocked level, **Then** the level loads into the in-game view.
2. **Given** an overworld with a locked level, **When** the player attempts to select it, **Then** selection is rejected and the level remains marked locked.
3. **Given** Level A defines "70% completion unlocks Level B", **When** the player completes Level A at 70% or higher, **Then** Level B becomes unlocked in the overworld.
4. **Given** Level A defines "100% completion unlocks Level A-Special", **When** the player completes Level A at exactly 100%, **Then** Level A-Special becomes unlocked while a 70–99% result leaves it locked.
5. **Given** a level whose unlock condition requires delivery of a specific named optional train, **When** the player completes the level having delivered that train, **Then** the dependent level is unlocked.

---

### User Story 3 - Persist progress with auto save/load (Priority: P2)

A player's progress (which levels are unlocked, best completion result per level, and the current in-progress level state) is automatically saved and restored so they can close the game and resume later without losing progress.

**Why this priority**: Persistence is essential for any progression-based game and is expected by players, but the game is demonstrable without it, so it ranks below the core loop.

**Independent Test**: Unlock a level and partially place tiles, reload the application, and confirm the unlocked levels and in-progress tile layout are restored.

**Acceptance Scenarios**:

1. **Given** a player has unlocked several levels, **When** they close and reopen the game, **Then** the same levels remain unlocked.
2. **Given** a player is partway through arranging track in a level, **When** the game is reloaded, **Then** the placed/rotated tiles and switch states are restored to where they left off.
3. **Given** a player completes a level with a better result than before, **When** the result is saved, **Then** the stored best result for that level is updated to the higher value.
4. **Given** no prior save exists, **When** the game first loads, **Then** a fresh state is created with only the initial level(s) unlocked.

---

### User Story 4 - Operate switches to direct trains (Priority: P2)

A player encounters switch tiles that can route a train down one of multiple branches. The player toggles a switch before or during a run to control which way trains travel, enabling solutions where multiple trains share track but must diverge to different stations.

**Why this priority**: Switches add the central puzzle depth that distinguishes the game from simple path-drawing, but the core loop (P1) can be demonstrated with non-switch track first.

**Independent Test**: Build a layout where one incoming track splits via a switch toward two differently colored stations, toggle the switch to each position, and confirm a train follows the selected branch each time.

**Acceptance Scenarios**:

1. **Given** a switch tile with two possible outgoing branches, **When** the player toggles the switch, **Then** the active branch changes and is visually indicated.
2. **Given** a switch set to branch A, **When** a train enters the switch, **Then** the train exits along branch A.
3. **Given** a crossing tile where two tracks intersect without connecting, **When** trains travel each track, **Then** they pass through the crossing on their own lines without merging.

---

### User Story 5 - Create and edit levels in the level editor (Priority: P3)

A level designer uses an in-app level editor to lay out a hex grid: placing terrain and locked tiles, designating editable grass tiles, positioning source and destination stations with color themes, defining trains (color, source, destination, start delay, required/optional), setting the exit requirement, and specifying which other levels are unlocked at which completion thresholds. The designer can save the level and play it.

**Why this priority**: The editor enables content creation and scales the game, but players can enjoy hand-authored levels without it, so it is the lowest priority.

**Independent Test**: Use the editor to author a minimal level with one source station, one destination station, one train, and an exit requirement, save it, then load and play it to a successful completion.

**Acceptance Scenarios**:

1. **Given** the level editor is open, **When** the designer places a station and assigns it a color theme, **Then** the station appears on the grid with that color.
2. **Given** the level editor, **When** the designer marks tiles as locked or as editable grass, **Then** those lock states are recorded in the level definition.
3. **Given** the level editor, **When** the designer defines a train with a color, source station, destination station, start delay, and required/optional flag, **Then** that train is added to the level.
4. **Given** the level editor, **When** the designer sets exit requirements and unlock rules referencing other levels, **Then** those conditions are stored with the level.
5. **Given** a level authored in the editor, **When** the designer saves and then loads it, **Then** the played level matches the authored layout, trains, and conditions.

---

### User Story 6 - Experience audio and 3D presentation (Priority: P3)

A player experiences the game rendered as isometric 3D voxel graphics—hexagonal tiles with voxel terrain, track, trains, decorations, and stations—and can zoom and pan the camera. The game works on both desktop (mouse/keyboard) and mobile (touch), with a responsive layout that adapts to large and small screens in either portrait or landscape orientation. Background music and sound effects accompany menu navigation and gameplay events (train departure, arrival, crash). The player can access a main menu to start, continue, open the editor, and adjust settings.

**Why this priority**: Presentation and audio strongly affect enjoyment (a constitutional priority) but are layered on top of functional gameplay; the loop works without final art and sound.

**Independent Test**: Launch the game, confirm the main menu appears, enter a level, zoom and pan the camera over the voxel scene, and confirm music plays and a sound effect triggers on a train event.

**Acceptance Scenarios**:

1. **Given** the game is launched, **When** it finishes loading, **Then** a main menu is presented with options to start/continue, open the level editor, and adjust settings.
2. **Given** a level is loaded, **When** the player uses zoom and pan controls, **Then** the isometric camera zooms and pans smoothly over the scene.
3. **Given** the scene is rendered, **When** it displays tiles, terrain, track, trains, stations, and decorations, **Then** they appear as voxel models on a hexagonal tile grid.
4. **Given** audio is enabled, **When** the player navigates menus or a train departs, arrives, or crashes, **Then** corresponding music and sound effects play.
5. **Given** the settings, **When** the player adjusts or mutes music and sound effect volume, **Then** the audio output changes accordingly and the preference is remembered.
6. **Given** the game is opened on a touch device, **When** the player taps a grass tile to place track, taps a placed tile to rotate it, taps a switch to toggle it, drags one finger to pan, and pinches to zoom, **Then** each action performs its intended effect.
7. **Given** the game is opened on a small phone screen in either portrait or landscape, **When** the layout renders, **Then** all controls and the playfield remain usable without requiring forced rotation or horizontal page scrolling.

---

### Edge Cases

- What happens when a train's path is incomplete or the player starts a run with gaps in the track? The affected trains run until they reach the end of track and crash (counted as lost), and the run still resolves against the exit requirement.
- How does the system handle a train reaching a correctly colored station? The train is counted as completed and removed from the simulation.
- What happens when an optional train is lost? It does not count against the exit requirement's required-train percentage, but failing to deliver it may leave its dependent unlocks locked.
- What happens when two trains would swap positions or arrive at the same tile simultaneously? They are treated as a collision and both crash.
- How does the system handle a level with no valid solution authored by mistake in the editor? The level is still playable; the player simply cannot meet the exit requirement and may retry or exit.
- What happens if a save state references a level definition that no longer exists or changed? The game falls back to a safe state, preserving unlock progress where possible and reinitializing in-progress level state if it cannot be restored.
- How does the system handle the very first launch with no save data? A fresh game state is created with only the initial level(s) unlocked.
- What happens when a player rotates or removes a tile mid-run? Tile editing is only permitted while the simulation is not running; during a run the layout is locked except for permitted switch toggles.
- How does the system handle a train routed into a switch set against it (no valid outgoing branch)? The train reaches the end of available track and crashes.

## Requirements *(mandatory)*

### Functional Requirements

#### Grid and Tiles

- **FR-001**: System MUST present the playfield as a hexagonal tile grid.
- **FR-002**: System MUST support track tile shapes including straight, slight curve, sharp curve, switch, and crossing.
- **FR-003**: Users MUST be able to place a track tile onto an editable (unlocked grass) tile.
- **FR-004**: Users MUST be able to rotate a placed track tile through the valid hex orientations.
- **FR-005**: Users MUST be able to remove or replace a track tile they previously placed on an editable tile.
- **FR-006**: System MUST prevent placement, rotation, or removal of tiles on locked tiles (stations, forest, lake, mountain, mountain tunnel, mountain tunnel interior tracks).
- **FR-007**: System MUST visually connect adjacent track tiles whose endpoints align so that a continuous path is recognizable.
- **FR-008**: Users MUST be able to toggle a switch tile between its alternative outgoing branches.
- **FR-009**: System MUST allow track editing only while the train simulation is not running, while permitting switch toggles per the level's rules.

#### Trains and Simulation

- **FR-010**: System MUST start each train after its level-defined start delay from a source station position.
- **FR-011**: System MUST move trains along connected track from their source toward their destination.
- **FR-012**: Each train MUST have a color theme, and each station MUST have a color theme.
- **FR-013**: System MUST count a train as completed only when it arrives at a station whose color theme matches the train's color theme and which is its intended destination.
- **FR-014**: System MUST count a train as lost when it reaches the end of track (no valid continuation).
- **FR-015**: System MUST count both trains as lost (crashed) when two trains collide on the same tile.
- **FR-016**: System MUST count a train as lost when it arrives at a station whose color theme does not match the train.
- **FR-017**: System MUST distinguish required trains from optional trains, where only required trains count toward the exit requirement percentage.
- **FR-018**: System MUST end a run when all trains have either completed or been lost, and report the resulting completion outcome.

#### Levels and Progression

- **FR-019**: System MUST load a level from a level definition that specifies the initial grid state, each tile's lock state, station positions and colors, and the trains.
- **FR-020**: Each level MUST define an exit requirement expressed as a minimum percentage of required trains that must not be lost.
- **FR-021**: System MUST evaluate the exit requirement at the end of a run and mark the level cleared or failed accordingly.
- **FR-022**: System MUST record the player's completion result (percentage and which specific trains were delivered) for each level.
- **FR-023**: Each level MUST be able to define multiple unlock rules, each pairing a completion condition (a completion percentage threshold and/or delivery of specific named trains) with one or more levels to unlock.
- **FR-024**: System MUST unlock dependent levels when their completion conditions are satisfied by a run result.
- **FR-025**: System MUST present an overworld, rendered as a hex grid, for selecting levels.
- **FR-026**: System MUST allow selection of unlocked levels and prevent selection of locked levels in the overworld.
- **FR-027**: System MUST allow the player to retry a level after a failed or successful run.

#### Persistence

- **FR-028**: System MUST automatically save game state, including unlocked levels, best per-level results, and current audio/settings preferences.
- **FR-029**: System MUST automatically save the in-progress state of a level the player is working on (placed tiles, rotations, switch states).
- **FR-030**: System MUST automatically restore saved state when the game is reopened.
- **FR-031**: System MUST initialize a fresh game state with only the initial level(s) unlocked when no saved state exists.
- **FR-032**: System MUST update a stored per-level best result only when a new run produces a better result.

#### Level Editor

- **FR-033**: System MUST provide a level editor for authoring and modifying level definitions.
- **FR-034**: The editor MUST allow placing terrain/locked tiles and editable grass tiles and designating each tile's lock state.
- **FR-035**: The editor MUST allow placing source and destination stations and assigning each a color theme.
- **FR-036**: The editor MUST allow defining trains with a color theme, source station, destination station, start delay, and required/optional flag.
- **FR-037**: The editor MUST allow specifying a level's exit requirement and its unlock rules referencing other levels.
- **FR-038**: The editor MUST allow saving a level and loading it for play, preserving the authored layout, trains, and conditions.

#### Presentation, Audio, and Menus

- **FR-039**: System MUST render the scene as isometric 3D graphics using voxel models for terrain, track, trains, decorations, and stations on hexagonal tiles.
- **FR-040**: Users MUST be able to zoom and pan the camera over the scene in both gameplay and the overworld, using mouse/keyboard on desktop and touch gestures (one-finger drag to pan, two-finger pinch to zoom) on mobile.
- **FR-041**: System MUST provide a main menu with options to start/continue a game, open the level editor, and adjust settings.
- **FR-042**: System MUST play background music and sound effects for menu navigation and gameplay events (at minimum train departure, arrival, and crash).
- **FR-043**: Users MUST be able to adjust or mute music and sound effect volume, and the preference MUST persist.
- **FR-044**: System MUST support both desktop and mobile devices, accepting mouse/keyboard input on desktop and touch input on mobile for all core interactions (placing track, rotating tiles, toggling switches, panning, zooming, navigating menus, and using the level editor).
- **FR-045**: On touch devices, core actions MUST be operable via touch: tapping a tool/grass tile to place track, tapping a placed editable tile to rotate it, tapping a switch to toggle it, dragging to pan, and pinching to zoom.
- **FR-046**: System MUST present a responsive layout that adapts to screen sizes from small phones (≥ ~360 CSS px wide) through large desktop displays, in both portrait and landscape orientation, without forcing the user to rotate the device.
- **FR-047**: On touch devices, interactive controls (buttons, tool selectors, switches) MUST present touch targets of at least 44×44 CSS px.

#### Testing & Quality Harness

- **FR-048**: The game simulation/model MUST be deterministic: given identical initial game state, scripted inputs, and random seed, repeated runs MUST produce identical results.
- **FR-049**: The simulation MUST advance in discrete, individually steppable ticks so a test can run a precise number of steps and assert on the resulting game state.
- **FR-050**: The simulation/game model MUST be decoupled from rendering, audio, and physical input devices so it can be instantiated and run headlessly without a real canvas, DOM, or audio output.
- **FR-051**: The system MUST allow tests to inject inputs programmatically (e.g., place/rotate/remove a tile, toggle a switch, start a run) at controlled simulation steps.
- **FR-052**: The system MUST expose a test-controlled view abstraction so tests can observe game state (tiles, trains, train statuses, completion outcome) without requiring real graphical rendering.
- **FR-053**: The project MUST include unit tests covering pure logic units (e.g., hex adjacency/coordinates, track connectivity, unlock-rule evaluation, completion-percentage calculation, save/load serialization).
- **FR-054**: The project MUST include game-model tests that load a level or game state, run a controlled number of steps with scripted input, and assert expected game-state outcomes (e.g., a train reaching its station, a crash, a level cleared/failed result).
- **FR-055**: The project MUST include end-to-end tests using Playwright that drive the actual game in a browser to validate primary user flows (e.g., main menu → select level → build track → run → cleared; reload restores saved state).
- **FR-056**: All test layers (unit, game-model, end-to-end) MUST be runnable non-interactively via single-line commands in headless mode, returning a clear pass/fail exit status suitable for Copilot-driven and CI automation.

### Key Entities *(include if feature involves data)*

- **Tile**: A single hexagonal cell of the grid. Has a position (hex coordinate), a terrain/content type (grass, forest, lake, mountain, mountain tunnel, tunnel interior, station, or track), a lock state (locked or editable), and—if it holds track—a track shape and orientation, plus switch branch state where applicable.
- **Track Shape**: The connectivity pattern of a track tile (straight, slight curve, sharp curve, switch, crossing), defining which hex edges it connects and, for switches, the selectable branches.
- **Station**: A special tile that serves as a train source and/or destination. Has a position and a color theme used to match trains.
- **Train**: A moving unit with a color theme, a source station, a destination station, a start delay, a required/optional flag, and a runtime status (waiting, running, completed, lost). May be referenced by name for unlock conditions.
- **Level**: A complete puzzle definition: grid layout with per-tile lock states, stations, trains, an exit requirement (minimum percentage of required trains delivered), and unlock rules.
- **Unlock Rule**: A condition-to-target mapping within a level pairing a completion condition (percentage threshold and/or specific named train deliveries) with the level(s) it unlocks.
- **Overworld**: The hex-grid map used to browse and select levels, reflecting each level's locked/unlocked status.
- **Game State (Save)**: Persistent player progress: unlocked levels, best per-level results, current in-progress level layout, and settings/audio preferences.
- **Settings**: Player preferences including music and sound effect volume and mute states.
- **Game Model (Simulation)**: The deterministic, headless-steppable core that holds the authoritative game state (grid, tiles, trains, run status) and advances it one tick at a time given injected inputs; independent of rendering, audio, and physical input.
- **View Abstraction**: An interface through which game state is observed and presented. A real implementation renders the isometric voxel scene; a test-controlled implementation exposes state for assertions without graphical rendering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can load a level, place and rotate track, run the simulation, and receive a clear cleared/failed outcome based on the exit requirement, with no manual setup steps beyond selecting the level.
- **SC-002**: When a run ends, the reported completion percentage exactly matches the proportion of required trains delivered to their correct stations in 100% of runs.
- **SC-003**: Completing a level at or above a defined unlock threshold unlocks the corresponding level(s) in the overworld 100% of the time, and completing below the threshold never unlocks the gated level(s).
- **SC-004**: After closing and reopening the game, 100% of previously unlocked levels, best results, in-progress layouts, and settings are restored.
- **SC-005**: A level designer can author a minimal playable level (one source, one destination, one train, an exit requirement) and play it to completion using only the in-app editor, without editing files by hand.
- **SC-006**: The camera responds to zoom and pan input within 100 milliseconds of player input under normal play.
- **SC-007**: Collisions, end-of-track crashes, and wrong-station arrivals are each correctly classified as lost in 100% of tested scenarios, and correct-color arrivals are classified as completed in 100% of tested scenarios.
- **SC-008**: A new player can clear the first tutorial-level puzzle within 5 minutes of first launch without external instructions.
- **SC-009**: Music and at least the train departure, arrival, and crash sound effects play at the correct moments, and volume/mute preferences persist across sessions 100% of the time.
- **SC-010**: All core interactions (place track, rotate tile, toggle switch, pan, zoom, navigate menus, use the level editor) are completable using touch alone on mobile and using mouse/keyboard alone on desktop.
- **SC-011**: The game is playable without horizontal page scrolling or forced device rotation on screens from ~360 CSS px wide through large desktop displays, in both portrait and landscape orientation.
- **SC-012**: Running the same level with the same scripted inputs and seed produces identical game-state outcomes on 100% of repeated runs (deterministic).
- **SC-013**: A game-model test can load a level, run a controlled number of steps with scripted input via a headless view, and assert on game state without launching a browser or rendering graphics.
- **SC-014**: The full test suite (unit, game-model, and end-to-end) runs to completion non-interactively via single-line commands and reports an unambiguous pass/fail result.
- **SC-015**: All three test layers — unit, game-model, and browser-based end-to-end — exist and exercise at least the core gameplay loop, progression/unlocking, and save/load persistence.

## Assumptions

- The game runs entirely client-side as a static web application in evergreen browsers on both desktop and mobile devices; no server, account system, or network multiplayer is in scope (per the project constitution's static-web-only technology stack).
- Persistence uses local in-browser storage on the player's device; progress is per-browser and not synced across devices.
- A single local player is assumed; no simultaneous multi-user play.
- "Completion percentage" for a level is computed over required trains only; optional trains affect specific named-train unlock conditions but not the percentage threshold.
- A run's "result" includes both the percentage of required trains delivered and the set of specific trains delivered, so unlock rules can reference either.
- The first level (or a small initial set) is unlocked by default in a fresh game state.
- Trains occupy and traverse one tile at a time; a collision is defined as two trains occupying the same tile in the same simulation step (including position swaps).
- Track editing is disabled during an active run; switch toggling availability during a run follows each level's configuration, defaulting to allowed.
- Voxel models, music, and sound effects are provided as game assets; this specification covers their behavior and triggering, not their artistic production.
- The game supports both desktop and mobile: mouse/keyboard input on desktop and touch input on mobile, with a responsive layout adapting to screen sizes from small phones (~360 CSS px wide) through large desktop displays in both portrait and landscape orientation.
- End-to-end tests use Playwright; unit and game-model tests run in a headless runtime without a browser. All test layers run headlessly and non-interactively to support Spec/Test-Driven, Copilot-automated development (per the project constitution).
- A separation between the game model (deterministic, headless-steppable simulation) and the presentation layer (rendering, audio, input) is assumed so the model can be tested in isolation; this is a structural quality requirement, not a prescription of a specific framework.
