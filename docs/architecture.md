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
targets, notes, reload, capabilities, and review-workspace mutations. Its own
protocol version is independent from the broker registration version. Host
capabilities are explicit so a partial host cannot silently accept an unsupported
action.

Current `hunk session` JSON remains an ingress compatibility format during the
spike. A strict adapter validates it, resolves paths/tab labels through the live
host, and projects it into product-neutral `review.*`, `workspace.*`, and `note.*`
actions. Hunk view options stay outside review-source identity.

## Frontend

The Solid composition root creates controllers once and wires them in dependency
order. The first shell slice has separate settings, review-workspace, sidebar,
Git-history, and review-note controllers. Presentational `ui/` modules receive
reactive props and callbacks and never import the composition root.

The shell currently loads one local project, opens its changed documents as tabs,
and provides Files, Git comparison, History, and Notes sidebar surfaces. One compact
review header owns project/source totals; a subordinate document strip, bounded
navigation rail, in-stream file summaries, and progressive footer establish the
visual hierarchy. Theme, sidebar visibility/width, wrapping, and auto/split/stack
layout are process-global settings rather than tab state. The main pane asynchronously
plans every changed document and projects them into one ordered OpenTUI scrollbox;
tabs, sidebar rows, file/hunk keys, row clicks, and agent commands reveal exact stable
targets without replacing the stream. Manual scrolling follows the viewport-centered
planned row without issuing another reveal, so active identity stays exact without a
scroll feedback loop. Review scrolling uses Hunk's tuned macOS wheel acceleration and
one-column overlay scrollbar: hidden until activity, auto-hidden after two seconds,
draggable by its proportional thumb, and viewport-paged from track clicks. OpenTUI's
built-in scrollbar stays disabled. No selected-document, plain-patch, or OpenTUI
built-in diff fallback remains.

Equivalent actions use Hunk's default chords (`q`, `s`, `t`, `w`, `0`/`1`/`2`,
`,`/`.`, and `[`/`]`). Hunk's row/page/content scroll bindings also address the same
stream (`j`/`k`, arrows, `d`/`u`, PageUp/PageDown, Space/Shift+Space, `f`/`b`,
`g`/`G`, and Home/End). Sidebar surfaces without a matching Hunk command stay clickable
instead of stealing unrelated keys. Document and hunk traversal use the same exact
identities exposed to agent navigation.

Review workspaces are process-level project/range identities. Document tabs live
inside the active review workspace. They are not interchangeable.

## Diff engine

`diff-engine` has no Solid or React dependency. It owns:

- Pierre patch and unsaved-buffer parsing with stable hunk identities;
- content-addressed Shiki/TextMate themes, exact scope overrides, and Pierre word emphasis;
- terminal-cell-aware wrapped row heights, line-number gutters, and row offsets;
- split/stack geometry, context-fold ranges, exact annotation anchors, and bounded plans.

The thin Solid renderer translates those typed plans into OpenTUI elements and owns no
diff parsing or geometry. Project loading uses the same engine summary for protocol
hunks, so agent navigation and rendered rows share exact identities.

## Migration boundary

The measured foundation gate selected Reviewbench as the successor. Hunk remains the
temporary behavior oracle and fallback until Reviewbench passes explicit replacement
gates for its remaining review interactions; Druk remains the shell/editor reference.
Neither source frontend is embedded or maintained as a permanent second rendering path.
Every closed slice must stay directly runnable through `mise run demo` before another
broad feature slice begins.

## Backend

Only Bun transports ship. The extraction preserves Hunk's local daemon lifecycle,
wire/body limits, schema validation, selector behavior, stale-session expiry,
loopback/DNS-rebinding defenses, idle shutdown, and CLI-visible capabilities.

The existing Hunk host remains compatible while Reviewbench is a second host.
Reviewbench now starts the extracted Bun daemon on Hunk's loopback port (or
`HUNK_MCP_PORT`), registers its live protocol snapshot over WebSocket, and exposes
the bounded existing-compatible HTTP actions proven in the spike: list, get,
context, review, navigate, comment add/list/remove. Unsupported capabilities are
not advertised. Host/Origin validation, JSON/body limits, stale-session behavior,
and exact target resolution remain enforced.

Host capabilities make partial migration explicit rather than silently accepting
commands a host cannot perform.

## Provenance

Hunk and Druk are MIT-licensed upstream sources. Material source adaptations retain
focused provenance and the repository-level [NOTICE](../NOTICE). Generated binary
notices will include transitive native/runtime licenses before publication.
