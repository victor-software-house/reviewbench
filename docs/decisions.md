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
- 2026-08-09 — Preserve Hunk's broker behavior first with package-local `exactOptionalPropertyTypes: false`; task 11 removes that extraction compatibility boundary while defining Reviewbench's exact product-neutral protocol.
- 2026-08-09 — Version the Reviewbench protocol independently from broker registration. Stable document, hunk, side, and line identities cross the host boundary; visible paths and row positions never substitute for those identities.
- 2026-08-09 — Keep Hunk compatibility as a validated projection from current `hunk session` requests into product-neutral review, workspace, and note actions. Hunk view options do not become review-source identity.
- 2026-08-09 — Seed the shell on OpenTUI 0.5.1 with its exact Solid 1.9.12 peer. The app package alone skips dependency declaration checking because OpenTUI 0.5.1's declarations conflict with TypeScript 7; Reviewbench source remains fully strict.
- 2026-08-09 — Keep the shell's temporary patch display plain and singular. Do not add OpenTUI's built-in diff widget before the framework-neutral Pierre/Shiki plan replaces it.
