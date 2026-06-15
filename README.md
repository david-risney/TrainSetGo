# TrainSetGo

A web-based hex-tile train-routing puzzle game. Place and rotate track tiles, toggle
switches, and route colored trains to matching stations across a campaign of unlockable
levels — plus a level editor, music, and sound effects.

Built with **vanilla HTML, CSS, and JavaScript (ES2022 modules)** — no frameworks, no
bundlers, no 3D engine. The scene is rendered on a Canvas 2D isometric projection.

## Running

```sh
npm install            # install dev dependencies (Playwright)
npm run serve          # static server on http://localhost:4173
```

Then open <http://localhost:4173>. No build step is required; the browser loads the ES
modules in `src/` directly.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/model/` | Deterministic, DOM-free game logic (hex grid, track, simulation, save, unlocks). |
| `src/view/` | Canvas renderer, camera (zoom/pan), Pointer-Events input, Web Audio. |
| `src/ui/` | Screens: overworld (home/level-select), in-game, level editor, settings. |
| `src/levels/` | Level definitions and the `campaign.json` manifest. |
| `src/app.js` | Bootstrap, screen router, and the `window.TrainSetGo` test surface. |
| `tests/unit/` | Pure-function unit tests (`node --test`). |
| `tests/model/` | Headless game-model scenario tests (load a level, step, assert state). |
| `tests/e2e/` | Playwright browser tests driving the real app. |

## How to play

1. **Start** on the overworld home screen and pick an unlocked level (each named
   station on the map is a level). The **Settings** station opens settings, and a
   **Play/Continue** button resumes your in-progress level.
2. You get **4 random track pieces** at the bottom — the slots show the piece *model*. Pick
   one and **tap a grass tile** to place it. The piece is **auto-rotated to best fit** the
   surrounding track.
3. To nudge a piece's rotation, tap the **floating ⟳ button** that appears next to the piece
   you just placed. **Tap a switch tile** to toggle which branch it connects.
4. Trains run continuously — deliver each train to the station matching its color. Trains are
   lost if they run off the end of track, collide, or reach the wrong station. Press
   **Escape** to return to the overworld.
5. Meet a level's delivery requirement to **unlock** further levels (some thresholds and
   specific train deliveries unlock bonus levels).

The status bar shows a **now-playing** widget (spinning disc, song + artist, a **Next**
button, and a music **mute** toggle). The menu/overworld and each level play their own
configured track — the menu uses the manifest's `menuMusic`, and a level uses its `music`
field.

Progress (unlocks, best results, in-progress placements) and audio settings auto-save to
`localStorage`.

## Documentation

- [docs/architecture.md](docs/architecture.md) — how the code is organized.
- [docs/coding-style.md](docs/coding-style.md) — coding conventions.
- [docs/README.md](docs/README.md) — docs index and when to update docs.
- [AGENTS.md](AGENTS.md) — entry point for AI agents and contributors.

## Testing

The game is built for automated, non-interactive verification (single-line test harnesses):

```sh
npm run test:unit      # pure-function unit tests
npm run test:model     # headless game-model scenario tests
npm run test:e2e       # Playwright browser tests (run `npx playwright install chromium` once)
npm test               # all of the above
```

The deterministic model (`src/model/`) avoids `Math.random` and wall-clock time, so model
tests reproduce identical runs from a level seed.
