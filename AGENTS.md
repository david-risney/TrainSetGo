# AGENTS.md

Guidance for AI agents and new contributors working in this repository. Read this first.

## What this is

TrainSetGo is a **static, vanilla-JavaScript** hex-tile train-routing puzzle game. No
framework, no bundler, no build step — the browser loads `src/app.js` (ES2022 modules)
directly. The game model is deterministic and DOM-free so it can be simulated headlessly.

## Read the docs before changing code

| Start here | For |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Layer split (model/view/ui), data flow, rendering/camera model, persistence, tests. |
| [docs/coding-style.md](docs/coding-style.md) | Conventions to match: formatting, naming, error handling, determinism. |
| [docs/README.md](docs/README.md) | Docs index **and the rules for when to update docs**. |
| [README.md](README.md) | How to run, how to play. |
| [.specify/memory/constitution.md](.specify/memory/constitution.md) | Non-negotiable principles. |
| [specs/001-hex-train-puzzle/](specs/001-hex-train-puzzle/) | Feature spec, plan, data model, interface `contracts/`. |

## Hard rules (do not break)

1. **Static web only.** No frameworks (React/Vue/Angular), no utility-CSS frameworks, no
   server runtime, no compile-to-JS. Zero production dependencies.
2. **`src/model/` is deterministic and DOM-free** — importable in Node, no `Math.random`,
   no wall-clock, no DOM. Randomness comes from the seeded `Rng`. Never import `view/` or
   `ui/` from `model/`.
3. **Track connectivity has one source of truth:** `src/model/track.js` (`connectionPairs`).
   The renderer and piece-preview derive from it — don't reintroduce a local copy.
4. **`window.TrainSetGo` and `data-testid` attributes are a public contract** for the
   Playwright e2e tests. Keep them stable; give new controls a `data-testid`.
5. **Update docs in the same change** that changes what they describe — see the table in
   [docs/README.md](docs/README.md).

## Commands

```sh
npm install            # dev deps (Playwright only)
npm run serve          # static server on http://localhost:4173
npm run test:unit      # pure-function unit tests (node --test)
npm run test:model     # headless GameModel scenario tests (node --test)
npm run test:e2e       # Playwright browser tests (npx playwright install chromium once)
npm test               # all of the above
```

## Workflow expectations

- **Spec/test first** (constitution principle I): specs and tests precede implementation.
  Prefer a deterministic **model** test over an e2e test when the behavior can be expressed
  against `GameModel`.
- Run the relevant tests before and after your change; all three tiers must stay green.
- Make surgical changes that match the surrounding code; don't reformat unrelated lines.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/001-hex-train-puzzle/plan.md` (and its companion `research.md`,
`data-model.md`, `contracts/`, and `quickstart.md`).

Key facts for this feature:
- Static web game: vanilla JavaScript (ES2022 modules), no frameworks, no CSS
  frameworks, no 3D engine. Rendering via Canvas 2D isometric voxel compositing.
- Hard split: `src/model/` is deterministic and DOM-free (importable in Node);
  `src/view/` + `src/ui/` are browser-only behind a View Abstraction.
- Persistence via `localStorage` (versioned JSON). Input via Pointer Events.
- Tests (all single-line, headless): `node --test` for unit and game-model tests,
  Playwright for end-to-end. Node/Playwright are dev-only, not shipped.
<!-- SPECKIT END -->
