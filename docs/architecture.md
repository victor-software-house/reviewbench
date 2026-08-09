# Reviewbench Architecture

## System boundary

```text
agent / hunk session CLI
        |
        v
session-daemon (Bun) ---- session-core
        |
        v
review-protocol
        |
        v
Reviewbench host adapter
        |
        +--> Solid/OpenTUI application shell
        |
        +--> framework-neutral diff-engine
```

The daemon carries registrations, snapshots, and commands without interpreting
review state. `review-protocol` defines sources, documents, hunks, exact line
targets, notes, reload, capabilities, and review-workspace mutations.

## Frontend

The Solid composition root creates controllers once and wires them in dependency
order. Druk-derived shell patterns own project state, document tabs, settings,
theme, editor, sidebar, Git/history, and review notes. Presentational UI receives
reactive props and callbacks; it does not import the composition root.

Review workspaces are process-level project/range identities. Document tabs live
inside the active review workspace. They are not interchangeable.

## Diff engine

`diff-engine` has no Solid or React dependency. It owns:

- Pierre diff parsing and word-level change planning;
- Shiki/TextMate highlighting and exact scope overrides;
- terminal-cell-aware wrapped row plans;
- split/stack geometry and visible windows;
- context folds, annotation anchors, and copy text.

The Solid renderer translates these typed plans into OpenTUI elements. Once parity
is proven, no second diff engine remains.

## Backend

Only Bun transports ship. The extraction preserves Hunk's local daemon lifecycle,
wire/body limits, schema validation, selector behavior, stale-session expiry,
loopback/DNS-rebinding defenses, idle shutdown, and CLI-visible capabilities.

The existing Hunk host remains compatible while Reviewbench is a second host.
Host capabilities make partial migration explicit rather than silently accepting
commands a host cannot perform.

## Provenance

Hunk and Druk are MIT-licensed upstream sources. Material source adaptations retain
focused provenance and the repository-level [NOTICE](../NOTICE). Generated binary
notices will include transitive native/runtime licenses before publication.
