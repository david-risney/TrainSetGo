# Contract: Level Definition JSON

The format that level files (`src/levels/*.json`) use and that the editor reads/writes
(FR-019, FR-033–FR-038). The game and editor load the **same** format (SC-005). Coordinates are
axial hex `{q, r}`; edge indices are 0–5.

## Schema (informal)

```jsonc
{
  "id": "level-a",                       // string, unique across campaign
  "name": "First Steps",                 // string
  "seed": 12345,                          // int, deterministic simulation seed
  "grid": [
    {
      "q": 0, "r": 0,
      "terrain": "grass",                // TerrainType
      "lock": "editable",                // "locked" | "editable"
      "track": null                       // or a TrackPlacement (below); pre-authored/locked track
    },
    {
      "q": 1, "r": 0,
      "terrain": "mountainTunnel",
      "lock": "locked",
      "track": { "shape": "straight", "orientation": 0, "switchState": null }
    }
  ],
  "stations": [
    { "q": -2, "r": 0, "color": "red" },
    { "q": 3,  "r": 0, "color": "red" }
  ],
  "trains": [
    {
      "id": "t1",
      "name": "Red Express",             // optional; enables named-train unlocks
      "color": "red",
      "source": { "q": -2, "r": 0 },
      "destination": { "q": 3, "r": 0 },
      "startDelay": 0,                    // ticks
      "required": true
    }
  ],
  "exitRequirement": { "minRequiredDeliveredPct": 70 },  // 0..100
  "unlockRules": [
    { "condition": { "minCompletionPct": 70 }, "unlocks": ["level-b"] },
    { "condition": { "minCompletionPct": 100 }, "unlocks": ["level-a-special"] },
    { "condition": { "requiredTrainIds": ["t1"] }, "unlocks": ["level-c"] }
  ]
}
```

### TrackPlacement (embedded)

```jsonc
{
  "shape": "straight",        // straight | slightCurve | sharpCurve | switch | crossing
  "orientation": 0,           // 0..5 rotation in edge steps
  "switchState": null         // int branch index for "switch"; null otherwise
}
```

## Validation rules

- `id` non-empty and unique within the campaign manifest.
- Every `grid` entry has a unique `(q, r)`.
- `lock == "editable"` only for `terrain == "grass"`; all other terrains are `locked`.
- Every train `source`/`destination` matches an existing `stations` hex.
- `exitRequirement.minRequiredDeliveredPct` ∈ [0, 100].
- Each `unlockRules[].condition` has at least one of `minCompletionPct` (0–100) or
  `requiredTrainIds` (existing train ids); `unlocks` are level ids.
- Loader MUST reject (with a clear error) any level failing validation.

## Campaign manifest (`src/levels/campaign.json`)

```jsonc
{
  "schemaVersion": 1,
  "levels": [
    { "id": "level-a", "file": "level-a.json", "hex": { "q": 0, "r": 0 } }
  ],
  "initialUnlocked": ["level-a"]          // unlocked in a fresh game (FR-031)
}
```
