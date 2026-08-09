# Reviewbench

Reviewbench is an agent-controlled terminal review workbench built on
[OpenTUI](https://github.com/anomalyco/opentui).

It is a new public project combining three deliberately separate strengths:

- [Druk](https://github.com/letstri/druk)'s Solid application shell, controller-owned state, wrapping UI, editor, tabs, settings, and Git surfaces;
- [Hunk](https://github.com/modem-dev/hunk)'s Bun session daemon, agent control contract, Pierre/Shiki diff quality, word-level emphasis, review geometry, and annotations;
- Victor Software House's product integration, protocol extraction, Solid renderer, and release ownership.

## Status

**Architecture spike.** The first gate is intentionally narrow:

1. keep Hunk's Bun-only daemon and existing agent CLI semantics;
2. register and control one live Solid/OpenTUI Reviewbench process;
3. render one Hunk-quality diff without embedding React;
4. compare code size, latency, test cost, and behavior before broad migration.

Reviewbench has no Node runtime or Node transport path. Bun is the application,
tooling, test, and packaging runtime.

See [architecture](docs/architecture.md), [decisions](docs/decisions.md), and the
[foundation plan](docs/plan.md).

## License and provenance

MIT. Reviewbench preserves the copyright of Hunk, Druk, and Victor Software
House. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
