# Coding style

These conventions are **descriptive** — they capture how the existing TrainSetGo code is
already written. Follow them so new code reads like the rest of the codebase. When in doubt,
open a neighboring file and match it.

## Language & modules

- **ES2022 modules**, `"type": "module"`. Use `import`/`export`, never CommonJS in `src/`.
- **No transpilation, no framework, no bundler.** Code must run as-is in an evergreen
  browser (and, for `src/model/`, in Node). Don't add a build step.
- Use **named exports**. Classes are the unit of structure for stateful things
  (`GameModel`, `Renderer`, `Camera`, screens); plain functions for pure logic.
- Prefer modern baseline browser APIs (Canvas, Web Audio, Pointer Events,
  `requestAnimationFrame`). No polyfills, no legacy fallbacks.

## Formatting

- **2-space indentation**, semicolons, double-quoted strings.
- Trailing commas in multiline arrays/objects/arg lists.
- Keep lines reasonably short (~100 cols). Break long ternaries and call chains across lines
  as the existing code does.
- One class per "thing"; group methods by phase with a short banner comment, e.g.
  `// --- Simulation ----`.

There is no automated formatter configured. Match the surrounding file by hand.

## Naming

- `camelCase` for variables, functions, methods, and object keys.
- `PascalCase` for classes and for frozen enum objects (`TerrainType`, `TrackShape`,
  `ViewEvent`).
- Enum **values** are lowercase strings (`"grass"`, `"straight"`, `"switch"`). Always
  reference them through the enum constant, never as bare string literals in logic.
- A leading underscore marks an **internal/private** method or field by convention
  (`_tile`, `_emit`, `_computeNext`, `this._sink`). JS has no real privacy here; the
  underscore is the signal.
- `data-testid` attribute values are `kebab-case` (`btn-rotate-piece`, `tool-slot-0`).

## Comments

- Comment **why**, not what. Most functions need no comment; the code should be obvious.
- Every module starts with a 1–3 line header comment stating its responsibility and any
  hard constraint (e.g. "DOM-free", "Browser-only").
- When a line encodes a non-obvious decision or a fixed bug, leave a short note — ideally
  referencing the requirement (`(FR-039)`) or the symptom it prevents (e.g. the canvas
  feedback-loop note in `piece-preview.js`). These breadcrumbs are load-bearing; keep them.
- Don't leave commented-out code.

## Error handling

- **Model editing/validation:** return a result object for *expected* outcomes rather than
  throwing. The pattern is `{ ok: true, ...extra }` / `{ ok: false, reason: "locked" }` via
  the local `ok()` / `fail()` helpers in `simulation.js`. Callers check `res.ok`.
- **Hard validation** (a malformed level definition) throws a typed error
  (`LevelValidationError`) with a human-readable message. The editor catches it and shows it.
- **Browser/IO that may legitimately fail** (audio decode, `localStorage`, pointer capture)
  is wrapped in `try { … } catch { /* fallback */ }` and degrades gracefully — never let it
  break the game loop. Empty catch blocks must carry a one-line comment explaining the
  fallback.

## Determinism (model only)

- `src/model/**` must be **pure and deterministic**: no DOM, no `Math.random`, no
  `Date.now()`/`performance.now()`, no network. Randomness comes from the seeded `Rng`.
- Treat snapshots from `getState()` as immutable plain data — copy (`{ ...obj }`) when you
  store references that outlive a tick.

## View / UI conventions

- Build DOM with the `el()` / `button()` helpers in `src/ui/dom.js`. Don't hand-roll
  `document.createElement` chains or template-string HTML for structured UI.
- Every screen class implements `mount(root)` and cleans up in `dispose()` (remove global
  listeners, cancel animation frames). If a screen places HTML over the canvas, implement
  `afterRender()` to re-anchor it on camera changes.
- Keep transform/projection math in `renderer.js`. `camera.js` only holds state.
- All gameplay sound goes through `View.onEvent` + the `ViewEvent` enum, emitted by the
  model — UI/view code should not invent its own audio triggers.

## Tests

- Mirror `src/` structure under `tests/`. Unit tests for pure functions, model tests for
  `GameModel` scenarios, Playwright specs for end-to-end.
- Tests use the built-in `node:test` + `node:assert` (no extra runner) and must be runnable
  as a single non-interactive command.
- E2E tests drive the app through `window.TrainSetGo` and `data-testid` selectors. When you
  add user-facing controls, give them a stable `data-testid`.
- Prefer a deterministic **model** test over an e2e test when the behavior can be expressed
  against `GameModel`.

## Things to avoid

- Adding dependencies. The runtime has **zero** production dependencies; the only dev
  dependency is Playwright. Justify any addition against the constitution first.
- Duplicating the track-connectivity tables — derive from `model/track.js`.
- Deriving a canvas backing-store size from `clientWidth`/`clientHeight` without pinning the
  CSS size (unbounded growth bug).
- Importing `view/` or `ui/` from `model/`.
