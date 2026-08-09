# Reviewbench Decisions

- 2026-08-09 — Create Reviewbench as a new public VSH repository rather than a GitHub fork or a rename of Hunk/Druk.
- 2026-08-09 — Keep the project Bun-only; exclude Hunk's Node/WebSocket transport and any Node compatibility obligation.
- 2026-08-09 — Keep OpenTUI and use Solid for the application shell. Never embed React inside the Solid renderer tree.
- 2026-08-09 — Retain Hunk's generic daemon, agent CLI semantics, security bounds, session snapshots, exact navigation, notes/comments, reload, and named review workspaces.
- 2026-08-09 — Adopt Druk's controller-owned shell, wrapping/layout, document tabs, settings/theme, editor, Git/history, and review surfaces selectively—not its entire feature set.
- 2026-08-09 — Preserve Hunk's superior diff/highlighting behavior by extracting framework-neutral Pierre/Shiki/word-diff/geometry plans and writing a thin Solid renderer.
- 2026-08-09 — Treat review workspaces and document tabs as separate levels; do not collapse project and file identity into one tab model.
- 2026-08-09 — Preserve copyrights in this order: Ben Vinegar; Valerii Strilets; Victor Software House.
- 2026-08-09 — Stop broad migration at a measured decision gate after one agent-controlled host slice and one Hunk-quality diff slice.
