# Quickstart & Validation Guide: Hex Train Routing Puzzle Game

How to run and validate the game and its three test layers. All commands are single-line and
non-interactive (constitution: Copilot Automated Harness). Implementation lives in `src/`; this
guide references the contracts and data model rather than restating them.

## Prerequisites

- Node.js 20+ (tooling and tests only; the game itself ships as static files).
- A modern browser (Chrome/Firefox/Safari/Edge) for manual play and Playwright E2E.

## Install (dev/test tooling only)

```bash
npm install            # installs Playwright (only dev dependency); no runtime deps
npx playwright install # one-time browser download for E2E
```

## Run the game locally

```bash
npm run serve          # starts scripts/serve.mjs (dependency-free static server)
# open the printed URL (e.g., http://localhost:8080) in a browser
```

The game is static — any static file server (or opening `index.html` via a server) works. No
build step: the browser loads native ES modules directly.

## Test layers

### 1. Unit tests (pure logic, headless, no browser)

```bash
npm run test:unit      # node --test tests/unit
```

Validates: hex adjacency/coordinates (R12), track connectivity & rotation, unlock-rule evaluation,
completion-percentage math, save/load serialization & migration (FR-053).

### 2. Game-model tests (deterministic simulation, headless, no browser)

```bash
npm run test:model     # node --test tests/model
```

Each test loads a level, injects scripted input, runs a controlled number of `step()`s through a
test View, and asserts on `getState()` / `getRunResult()` (FR-054, contracts/simulation-api.md).
Covers the spec's core acceptance scenarios: train reaches matching station = `completed`; end of
track / collision / wrong station = `lost`; exit-requirement → `cleared`/`failed`.

### 3. End-to-end tests (real browser via Playwright)

```bash
npm run test:e2e       # npx playwright test (headless; webServer auto-starts scripts/serve.mjs)
```

Drives the assembled app in a browser for primary flows (FR-055): main menu → select level → build
track → run → cleared; reload restores saved state; touch and mouse interactions.

### Run everything

```bash
npm test               # unit + model + e2e; non-zero exit on any failure
```

## Validation scenarios (map to Success Criteria)

| Scenario | Command / action | Expected | SC |
|----------|------------------|----------|----|
| Core loop produces clear outcome | `test:model` core-loop test | `outcome` is `cleared`/`failed` per exit requirement | SC-001 |
| Completion % exact | `test:model` percentage test | `completionPct` == delivered required / total required | SC-002 |
| Unlock thresholds | `test:unit` unlock test | ≥ threshold unlocks target; below never unlocks | SC-003 |
| Save/restore | `test:e2e` reload test | unlocked levels, results, in-progress layout, settings restored | SC-004 |
| Editor round-trip | `test:e2e` editor test | author minimal level → play → complete | SC-005 |
| Determinism | `test:model` determinism test | identical state across two runs (same seed+input) | SC-012 |
| Headless model | `test:model` runs with no browser | passes without canvas/DOM | SC-013 |
| Non-interactive harness | `npm test` | single command, clear pass/fail exit code | SC-014 |
| All three layers exist | `test:unit`, `test:model`, `test:e2e` | each runs and exercises core loop, progression, persistence | SC-015 |

## Expected package scripts

```jsonc
// package.json (scripts) — dev/test only; no runtime dependencies
{
  "scripts": {
    "serve":      "node scripts/serve.mjs",
    "test:unit":  "node --test tests/unit",
    "test:model": "node --test tests/model",
    "test:e2e":   "playwright test",
    "test":       "node --test tests/unit tests/model && playwright test"
  }
}
```

## Notes

- Determinism: model tests must be reproducible; never introduce wall-clock or unseeded randomness
  into `src/model/` (R4, FR-048).
- Model purity: `src/model/` must not import browser/DOM APIs, or the headless model tests break
  (FR-050). Keep rendering/audio/input strictly in `src/view/`.
