# TrainSetGo documentation

Project documentation lives here. Start with whichever matches your task:

| Doc | Read it when you need to… |
| --- | --- |
| [architecture.md](architecture.md) | Understand how the code is organized — the model/view/ui split, data flow, rendering/camera model, persistence, and testing strategy. |
| [coding-style.md](coding-style.md) | Write code that matches the repo's conventions (formatting, naming, error handling, determinism rules). |
| [voxel-models.md](voxel-models.md) | Author or replace the `.vox` train/station models — recommended editors and the orientation/tint conventions. |

### Related material outside `docs/`

- [`README.md`](../README.md) — quick start, how to run, how to play.
- [`AGENTS.md`](../AGENTS.md) — entry point for AI agents and new contributors; links here.
- [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) — the
  non-negotiable project principles (static web only, spec/test-first, fun).
- [`specs/001-hex-train-puzzle/`](../specs/001-hex-train-puzzle/) — the feature spec, plan,
  data model, and interface `contracts/`. This is the source of truth for *what* the game
  should do and the shape of its core interfaces.

## When to update the docs

Documentation is part of the change, not an afterthought. Update docs **in the same change**
that alters the behavior or structure they describe. Use this table:

| If your change… | Update… |
| --- | --- |
| Adds/removes/renames a module, or changes layer boundaries (what may import what) | `architecture.md` (module map + the import rules) |
| Changes the rendering pipeline, camera transform, or a hard-won invariant (depth sort, focal zoom, canvas sizing) | `architecture.md` (Rendering & camera) |
| Changes the save schema, bumps `SCHEMA_VERSION`, or adds a migration | `architecture.md` (Persistence) **and** `specs/.../contracts/save-schema.md` |
| Changes the `GameModel` public API or a `contracts/` interface | the relevant file in `specs/.../contracts/` |
| Introduces a new convention, or you keep correcting the same style issue in review | `coding-style.md` |
| Changes how to run, build, or test the project | `README.md` (and `coding-style.md` if test conventions change) |
| Changes player-facing controls or how the game is played | `README.md` (How to play) |
| Adds or changes a `window.TrainSetGo` test hook or a `data-testid` contract | `architecture.md` (test surface) and any affected test docs |
| Changes the agent workflow, or what an agent should read first | `AGENTS.md` |

### Rules of thumb

- **Same PR.** A behavior change and its doc update belong together. A reviewer should never
  have to discover that a doc is now wrong.
- **Delete stale docs aggressively.** A confidently wrong doc is worse than no doc. If a
  paragraph no longer matches the code, fix or remove it.
- **Keep examples runnable.** Commands, file paths, and `data-testid`s in docs must be real.
- **Link, don't duplicate.** Point at the spec/contracts for authoritative detail instead of
  copying it (copies drift). These docs explain *how things hang together*; the spec defines
  *what the game must do*.
- **Cross-check the constitution.** Don't document a practice that violates a project
  principle (e.g. "add framework X"). Amend the constitution first if a principle truly needs
  to change.

> Sanity check before merging: did this change touch architecture, the save schema, a public
> API/test hook, a convention, or the run/play instructions? If yes, a doc here, in
> `README.md`, or in `specs/.../contracts/` should change too.
