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
| `src/ui/` | Screens: menu, overworld, in-game, level editor, settings. |
| `src/levels/` | Level definitions and the `campaign.json` manifest. |
| `src/app.js` | Bootstrap, screen router, and the `window.TrainSetGo` test surface. |
| `tests/unit/` | Pure-function unit tests (`node --test`). |
| `tests/model/` | Headless game-model scenario tests (load a level, step, assert state). |
| `tests/e2e/` | Playwright browser tests driving the real app. |

## How to play

1. **Start** from the menu to enter the overworld and pick an unlocked level.
2. Select a track tool, **tap a grass tile** to place track, and use **Rotate**, **Erase**,
   and **Toggle** (for switches) to shape the route.
3. Press **Run** to release the trains. Deliver each train to the station matching its
   color. Trains are lost if they run off the end of track, collide, or reach the wrong
   station.
4. Meet a level's delivery requirement to **unlock** further levels (some thresholds and
   specific train deliveries unlock bonus levels).

Progress (unlocks, best results, in-progress placements) and audio settings auto-save to
`localStorage`.

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
