<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial ratification)
  Modified principles: N/A (initial)
  Added sections:
    - Core Principles (3 principles)
    - Technology Stack
    - Governance
  Removed sections:
    - SECTION_3 (Development Workflow placeholder) — not needed;
      workflow is implicit in Principle II (Copilot Automated Harness)
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
  Follow-up TODOs: None
-->

# TrainSetGo Constitution

## Core Principles

### I. Spec/Test Driven

Specifications and tests MUST precede implementation code.

- Every feature MUST have a written specification before development
  begins.
- Automated tests MUST be written and validated (red) before the
  corresponding implementation is produced.
- Acceptance criteria in specs MUST be expressed as testable scenarios
  (Given/When/Then or equivalent).
- Code that lacks a backing spec or test is considered unauthorized and
  MUST NOT be merged.

**Rationale**: Specs and tests encode intent; writing them first
eliminates ambiguity and prevents scope creep.

### II. Copilot Automated Harness Development

Development is driven through AI-assisted automation with GitHub
Copilot; harnesses and tooling are built to support this workflow.

- The development workflow MUST be optimized for AI-agent-driven
  iteration (clear specs, deterministic test harnesses, minimal manual
  steps).
- Test harnesses MUST be runnable non-interactively so that Copilot
  agents can execute and interpret results autonomously.
- Build, lint, and test commands MUST be expressible as single-line
  invocations suitable for automation.
- Manual intervention SHOULD be limited to creative decisions (game
  design, art direction) and final approval gates.

**Rationale**: Maximizing automation throughput requires that every
repeatable task is machine-executable without human babysitting.

### III. Fun

The game MUST be fun above all else; gameplay enjoyment is the ultimate
measure of success.

- When a technical decision conflicts with player enjoyment, fun MUST
  win unless safety or correctness is at stake.
- Features MUST be evaluated through playtesting feedback, not solely
  through code metrics.
- Complexity that does not serve player experience MUST be removed or
  simplified.

**Rationale**: TrainSetGo exists to entertain. Technical excellence
that produces a boring game is a failure.

## Technology Stack

- **Platform**: Static web only — the game MUST be deployable as
  static HTML/CSS/JS files with no server-side runtime.
- **Languages**: Plain HTML, CSS, and JavaScript. No compile-to-JS
  languages (TypeScript is acceptable only if project opts in
  explicitly in a future amendment).
- **Frameworks**: NONE. No React, Vue, Angular, or similar. No utility
  CSS frameworks (Tailwind, Bootstrap).
- **APIs**: Modern baseline browser APIs (Canvas, Web Audio,
  requestAnimationFrame, ES modules, etc.) are encouraged.
- **Compatibility**: Target evergreen browsers (latest stable Chrome,
  Firefox, Safari, Edge). No IE11 or legacy polyfills.

## Governance

This constitution supersedes all other project practices and
conventions. All contributors (human and AI) MUST comply.

- **Amendments** require a pull request with clear rationale, at least
  one approving review, and a version bump following SemVer:
  - MAJOR: Principle removal or incompatible redefinition.
  - MINOR: New principle/section added or materially expanded.
  - PATCH: Clarifications, typo fixes, non-semantic refinements.
- **Compliance review**: Every PR MUST be checked against these
  principles before merge. Violations block merge.
- **Conflict resolution**: If two principles conflict, resolve in
  numbered order (I → II → III) unless the Fun principle (III) is
  explicitly invoked by a maintainer to override.

**Version**: 1.0.0 | **Ratified**: 2026-06-08 | **Last Amended**: 2026-06-08
