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

