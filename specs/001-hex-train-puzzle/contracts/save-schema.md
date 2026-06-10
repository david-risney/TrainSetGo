# Contract: Save / Game State JSON

The single versioned document persisted in `localStorage` under a fixed key
(e.g., `trainsetgo.save`). Managed by `src/model/save.js` (FR-028–FR-032, spec edge cases).

## Storage key

- Key: `trainsetgo.save`
- Value: JSON string of the document below.

## Schema (informal)

```jsonc
{
  "schemaVersion": 1,                     // int; drives migration / safe fallback
  "unlockedLevelIds": ["level-a", "level-b"],
  "bestResults": {
    "level-a": {
      "levelId": "level-a",
      "completionPct": 100,               // over required trains only
      "deliveredTrainIds": ["t1", "t2"],
      "outcome": "cleared"                // "cleared" | "failed"
    }
  },
  "inProgress": {                          // optional; null when no level in progress
    "levelId": "level-a",
    "tilePlacements": [
      { "q": 0, "r": 0, "shape": "straight", "orientation": 2, "switchState": null }
    ],
    "switchStates": [
      { "q": 1, "r": 1, "switchState": 0 }
    ]
  },
  "settings": {
    "musicVolume": 0.8, "sfxVolume": 1.0,
    "musicMuted": false, "sfxMuted": false
  }
}
```

## Behavioral contract

- **Auto-save** (FR-028/029): the app persists after meaningful changes — unlocking a level,
  recording a result, editing the in-progress layout, or changing settings. Writes are JSON
  serializations of the full document (atomic overwrite of the key).
- **Auto-load / restore** (FR-030): on startup the document is read and applied; unlocked levels,
  best results, in-progress layout, and settings are restored.
- **Fresh state** (FR-031): when no save exists (or it is unreadable), initialize from the campaign
  manifest's `initialUnlocked`, empty `bestResults`, no `inProgress`, default `settings`.
- **Best-result update** (FR-032): replace `bestResults[levelId]` only when the new result is
  strictly better — higher `completionPct`, or equal `completionPct` with a superset of
  `deliveredTrainIds`.
- **Migration / safe fallback** (edge cases): if `schemaVersion` is older, migrate forward; if it is
  unknown/incompatible or parsing fails, fall back to a fresh state but preserve `unlockedLevelIds`
  and `bestResults` where they can still be parsed. If `inProgress.levelId` no longer exists or its
  level definition changed incompatibly, drop `inProgress` while keeping unlock progress.

## Invariants

- `unlockedLevelIds` contains no duplicates and only known level ids (unknown ids are pruned on load).
- `settings` volumes ∈ [0, 1].
- The document is self-contained — restoring it fully reconstructs player-visible progress.
