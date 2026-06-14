# Phase 1 Data Model: Hex Train Routing Puzzle Game

Derived from the spec's Key Entities and Functional Requirements. The model is deterministic and
DOM-free (see plan.md). Coordinates are axial hex `{q, r}` (R12). "Edge index" 0–5 identifies a
hex side; direction/rotation are expressed as edge indices.

## Enumerations

- **TerrainType**: `grass` | `forest` | `lake` | `mountain` | `mountainTunnel` | `tunnelInterior` |
  `station` | `track`
- **TrackShape**: `straight` | `slightCurve` | `sharpCurve` | `switch` | `crossing`
- **LockState**: `locked` | `editable`  (only `grass` is `editable`; all others default `locked`)
- **ColorTheme**: a named palette key (e.g., `red`, `blue`, `green`, `yellow`, `purple`). Trains
  match stations by equal `ColorTheme`.
- **TrainStatus**: `waiting` | `boarding` | `running` | `completed` | `lost`
- **RunOutcome**: `cleared` | `failed`

## Entities

### Hex (value object)
- `q: int`, `r: int` — axial coordinates.
- Derived: `neighbors()` → 6 adjacent Hex; `edgeTo(other)` → edge index 0–5.
- Identity: a Hex is uniquely identified by `(q, r)`.

### Tile
- `hex: Hex` — position (unique key within a grid).
- `terrain: TerrainType`.
- `lock: LockState`.
- `track?: TrackPlacement` — present only when a track tile is placed or pre-authored.
- Rules:
  - Track may be placed/rotated/removed only when `lock == editable` (FR-003/004/005/006).
  - Stations and all non-grass terrain are `locked`.

### TrackPlacement
- `shape: TrackShape`.
- `orientation: int` (0–5) — rotation in edge steps (FR-004).
- `connections: EdgeIndex[]` — derived from `shape` + `orientation`: the hex edges this tile
  connects. `crossing` exposes two independent connection pairs that do **not** merge (FR-on
  crossings). `switch` exposes a fixed inbound edge plus selectable outbound branches.
- `switchState?: int` — index of the active branch for `switch` shapes (FR-008).
- Rules:
  - Two adjacent tiles are connected iff each lists the shared edge in `connections` (FR-007).

### Station
- `hex: Hex` — position (locked tile).
- `color: ColorTheme`.
- `role: source | destination | both` — derived from level train references.
- Rules: matches a Train iff `station.color == train.color` (FR-012/013/016).

### Train
- `id: string` — unique within a level; may be referenced by unlock rules (FR-023).
- `name?: string` — human/author label for named-train unlock conditions.
- `color: ColorTheme`.
- `source: Hex`, `destination: Hex` — station positions.
- `startDelay: int` — ticks before departure (FR-010).
- `required: bool` — required vs optional (FR-017).
- Runtime: `status: TrainStatus`, `position: Hex`, `headingEdge: int`.
- Lifecycle / state transitions:
  - `waiting` → `boarding` when `tick > startDelay` (train is produced and parked at its
    source station; the view shows a countdown over the station for the final ≤10 seconds).
  - `boarding` → `running` after a short dwell (`DWELL_TICKS`, ~2 seconds) at the station.
  - `running` → `completed` on entering its `destination` station with matching color (FR-013).
  - `running` → `lost` on: reaching end of track (FR-014); collision with another train
    (FR-015, both become `lost`); entering a wrong/mismatched station (FR-016).
  - `completed`/`lost` are terminal; the train is removed from active simulation.

### Level
- `id: string` — unique; referenced by overworld and unlock rules.
- `name: string`.
- `grid: Tile[]` — initial tiles incl. lock states, terrain, pre-placed/locked track.
- `stations: Station[]`.
- `trains: Train[]`.
- `exitRequirement: { minRequiredDeliveredPct: number }` — 0–100 (FR-020).
- `unlockRules: UnlockRule[]` (FR-023).
- `seed: int` — deterministic seed for the simulation (R4).
- Validation (FR-019): every train `source`/`destination` references an existing Station hex;
  every Tile hex is unique; `minRequiredDeliveredPct` ∈ [0,100]; unlock rule targets are level ids.

### UnlockRule
- `condition`:
  - `minCompletionPct?: number` — threshold over required trains (FR-023), and/or
  - `requiredTrainIds?: string[]` — specific trains that must be delivered.
- `unlocks: string[]` — level ids unlocked when the condition is met (FR-024).
- Semantics: a rule fires when **all** present sub-conditions are satisfied by a RunResult.
  Multiple rules per level allow branchy progression (e.g., 70%→B, 100%→A-Special).

### RunResult
- `levelId: string`.
- `completionPct: number` — `deliveredRequired / totalRequired * 100` (FR-022, SC-002); computed
  over **required** trains only (optional trains excluded from the percentage).
- `deliveredTrainIds: string[]` — all trains (required or optional) delivered correctly.
- `outcome: RunOutcome` — `cleared` iff `completionPct >= exitRequirement.minRequiredDeliveredPct`
  (FR-021).

### Overworld
- `levels: { id, hex, status }[]` — hex-grid placement and `status: locked | unlocked` per level
  (FR-025/026). Rendered with the same hex grid as in-game.
- `campaignManifest.initialUnlocked: string[]` — levels unlocked in a fresh game (FR-031).

### GameState (Save)
- `schemaVersion: int` — for migration/safe fallback (spec edge case).
- `unlockedLevelIds: string[]`.
- `bestResults: { [levelId]: RunResult }` — updated only when a new result is better (FR-032).
- `inProgress?: { levelId, tilePlacements, switchStates }` — current editable layout (FR-029).
- `settings: Settings`.
- Rules: on load, validate `schemaVersion`; if an `inProgress.levelId` no longer exists or its
  definition changed incompatibly, drop `inProgress` but preserve unlock progress (edge case).

### Settings
- `musicVolume: number` (0–1), `sfxVolume: number` (0–1), `musicMuted: bool`, `sfxMuted: bool`
  (FR-043, SC-009). Persisted within GameState.

### GameModel (Simulation) — runtime aggregate
- Holds the authoritative mutable state for an active level: working `grid` (with player edits),
  active `trains`, current `tick`, and `rng` seeded from `Level.seed`.
- Operations (see contracts/simulation-api.md): `loadLevel`, `placeTrack`, `rotateTrack`,
  `removeTrack`, `toggleSwitch`, `startRun`, `step`, `getState`, `getRunResult`.
- Invariants: edits allowed only while not running (FR-009); `step()` advances exactly one tick;
  deterministic given seed + input sequence (FR-048).

### ViewAbstraction — presentation boundary
- Not game data; the interface the model/app renders through (see contracts/view-abstraction.md).
- Real implementation: Canvas renderer + audio. Test implementation: records emitted state for
  assertions (FR-052).

## Relationship summary

- `Level` 1—* `Tile`, 1—* `Station`, 1—* `Train`, 1—* `UnlockRule`.
- `Train` references two `Station` hexes (source, destination); matches `Station` by `color`.
- `UnlockRule.unlocks` references other `Level` ids; `requiredTrainIds` references `Train` ids.
- `GameState.bestResults` keyed by `Level.id`; `unlockedLevelIds` ⊆ all `Level.id`.
- `Overworld` projects `Level` ids to hex positions + unlock status.
