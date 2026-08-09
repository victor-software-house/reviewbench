# Reviewbench

Public Bun-only terminal review workbench combining Druk's Solid/OpenTUI shell
with Hunk's agent session backend and diff quality.

Read [docs/decisions.md](docs/decisions.md), [docs/architecture.md](docs/architecture.md),
[docs/plan.md](docs/plan.md), and [CODING_STANDARDS.md](CODING_STANDARDS.md) before changing architecture.

## Non-negotiable boundaries

- Bun only. No Node runtime/transport package, `ws`, npm task pipeline, or Node CI setup.
- OpenTUI stays. Solid owns the app shell; never embed Hunk's React renderer.
- The Hunk session daemon/CLI contract is retained and extracted, not rewritten casually.
- Diff quality comes from framework-neutral Pierre/Shiki/word-diff/geometry plans rendered by Solid.
- Druk contributes controller/store architecture, wrapping/layout, tabs, settings, editor, and Git surfaces.
- `packages/session-*`, `review-protocol`, and `diff-engine` cannot import app or UI code.
- Preserve the three ordered copyright lines in `LICENSE` and focused provenance in `NOTICE`.
- Do not port broad Druk or Hunk feature sets before the decision gate in the foundation plan.
- Keep `mise run demo` runnable at every closed feature-slice boundary. Show that visible checkpoint and collect operator feedback before opening another broad product slice.
- Hunk's current default keybindings are canonical for equivalent Reviewbench actions. Do not bind an existing Hunk chord to a different shell action; leave unmigrated capabilities mouse-only or unbound.

## Intended layout

```text
apps/reviewbench/          Solid/OpenTUI application and CLI
packages/session-core/     generic broker envelopes
packages/session-daemon/   Bun daemon and connection lifecycle
packages/review-protocol/  product-neutral review contract
packages/diff-engine/      Pierre/Shiki/geometry plans
packages/test-kit/         shared fixtures
```

## Tooling contract

- Bun workspaces and test runner.
- Turborepo owns package task ordering.
- Mise owns repository orchestration and locked tools.
- Biome + type-aware oxlint.
- Lefthook runs repository gates; never bypass it.
- Changesets owns versions/changelog once packages become publishable.

## Commands

- Interactive visible checkpoint: `mise run demo` (representative fixture) or `mise run demo .` (current project)
- Install locked tools: `mise install --locked`
- Install dependencies: automatic before mise tasks, or `bun install --frozen-lockfile`
- Full gate: `mise run verify`
- Build: `mise run build`
- Test: `mise run test`
- Typecheck: `mise run typecheck`
- Lint: `mise run lint`
- Format: `mise run format`
- Install hooks: `mise run hooks:install`

## Review pressure points

- Product-neutral packages importing Solid/React/app code.
- Duplicate daemon, protocol, or diff paths.
- Node compatibility entering through dependencies or CI.
- Druk document tabs being confused with Hunk review-workspace tabs.
- Loss of Hunk wire/security bounds or exact line targeting.
- Diff regressions in word emphasis, syntax fidelity, wrap/CJK, or annotations.
- Source-derived code without provenance.
