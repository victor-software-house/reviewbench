# Reviewbench Foundation Plan

1. **Repository and contract** — public repository, Mani inventory, license,
   provenance, decisions, architecture, and contributor guidance.
2. **Bun monorepo baseline** — workspaces, Turborepo, mise, strict TypeScript,
   Biome/oxlint, Lefthook, frozen install, and Namespace Linux CI.
3. **Bun broker extraction** — runtime-neutral core plus Bun daemon/connection;
   no Node/ws adapter.
4. **Review protocol seam** — product-neutral sources/documents/hunks/targets,
   notes, reload, capabilities, and review-workspace tabs, with Hunk CLI compatibility.
5. **Minimal Druk shell** — Solid/OpenTUI controllers for one project, document
   tabs, global theme/settings, sidebar, Git/history, and review notes.
6. **Agent-controlled vertical slice** — register one live host; list/get/context,
   navigate, and add/list/remove a note through daemon/CLI and PTY tests.
7. **Hunk-quality diff proof** — framework-neutral Pierre/Shiki plans and a thin
   Solid renderer proving split/stack, word emphasis, wrap/CJK, context, themes,
   annotations, and large-file bounds.
8. **Decision gate** — compare code size, latency, test cost, diff quality, and
   agent behavior before broad migration.

## Gate result

The 2026-08-09 gate selected Reviewbench as the successor. Hunk remains the temporary
behavior oracle/fallback and Druk the shell/editor reference while explicit gaps close.
Every later feature slice must end with a real `mise run demo` checkpoint and operator
feedback before another broad slice starts. See [migration gate](migration-gate.md).

Every phase is a closed slice with implementation, consumers, docs, tests, and
visible verification. Temporary dual paths are removed inside the phase that
proves their replacement.
