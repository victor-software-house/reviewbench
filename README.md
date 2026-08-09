# Reviewbench

Reviewbench is an agent-controlled terminal review workbench built on
[OpenTUI](https://github.com/anomalyco/opentui).

It is a new public project combining three deliberately separate strengths:

- [Druk](https://github.com/letstri/druk)'s Solid application shell, controller-owned state, wrapping UI, editor, tabs, settings, and Git surfaces;
- [Hunk](https://github.com/modem-dev/hunk)'s Bun session daemon, agent control contract, Pierre/Shiki diff quality, word-level emphasis, review geometry, and annotations;
- Victor Software House's product integration, protocol extraction, Solid renderer, and release ownership.

## Status

**Runnable architecture slice.** The foundation gate is complete: one Bun daemon-backed
Solid/OpenTUI host is controllable through the existing Hunk CLI compatibility surface,
and its sole diff path renders framework-neutral Pierre/Shiki plans with word emphasis,
exact syntax scopes, split/stack geometry, wrapping, folds, themes, and line-anchored notes.

The measured gate selected Reviewbench as the successor. Hunk remains the temporary
behavior oracle and fallback while Reviewbench closes explicit parity gaps in visible,
runnable slices; Druk remains the shell/editor reference rather than another runtime.

Reviewbench has no Node runtime or Node transport path. Bun is the application,
tooling, test, and packaging runtime.

The current shell opens one project, keeps review workspaces above document tabs,
and exposes Files, Git comparison, History, and Notes surfaces with process-global
theme, sidebar, and wrapping settings.

## See the current slice

```sh
mise run demo       # representative changed repository
mise run demo .     # your current project
```

The command builds first and opens the real compiled TUI. Resize wide for split view.
Reviewbench keeps Hunk's bindings for equivalent actions: `q` quits, `s` toggles the
sidebar, `t` switches theme, `w` toggles wrapping, `0`/`1`/`2` select
auto/split/stack, `,`/`.` move between files, and `[`/`]` move between hunks.
Sidebar surfaces remain clickable until their matching Hunk command model exists; they
do not steal unrelated keys. Each future closed feature slice must keep this demo
runnable before the next slice begins.

## Develop

```sh
direnv allow
mise install --locked
mise run verify
mise run demo .
```

The repository is a Bun workspace orchestrated by Turborepo and mise. Package
scripts are atomic; repository gates live in `mise.toml`.

See [architecture](docs/architecture.md), [decisions](docs/decisions.md), and the
[foundation plan](docs/plan.md).

## License and provenance

MIT. Reviewbench preserves the copyright of Hunk, Druk, and Victor Software
House. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
