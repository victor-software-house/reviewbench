# Reviewbench Foundation Migration Gate

## Decision

Continue Reviewbench as the successor in closed, visible parity slices.

Hunk remains the temporary behavior oracle and fallback until explicit replacement gates pass. Druk remains the shell/editor reference. Neither source frontend becomes a permanent second Reviewbench rendering path.

Every later slice must leave `mise run demo` runnable and stop for operator-visible feedback before another broad slice begins.

## Measured evidence

Measurements were taken on 2026-08-09 on the same macOS arm64 workstation. Source counts include tracked TypeScript/TSX; test counts classify colocated and root test files separately. Focused upstream slices are comparison envelopes, not claims that every included line must migrate.

| Measure | Reviewbench | Hunk `0.18.0-beta.5` | Druk `1.16.1` |
| --- | ---: | ---: | ---: |
| Product source lines | 5,834 | 51,846 | 31,236 |
| Product test lines | 2,606 | 62,391 | 22,007 |
| Focused diff/session or shell slice | 1,028 source / 156 test | 11,068 source / 15,499 test | 20,144 source / 22,007 test |
| Compiled arm64 binary | 85.2 MB | 85.5 MB | 106.8 MB |
| Meaningful startup, first run | 518 ms to diff | 402 ms to diff | 348 ms to first file |
| Meaningful startup, warm median | 328 ms | 308 ms | 169 ms |
| Full repository gate | 1.73 s, pass | 114.15 s, pass | 461.81 s, failed |

Reviewbench's gate used warm local Turbo caches, matching the normal inner loop. Hunk's gate passed 2,015 tests with 17 skips. Druk's canonical sequential gate ran 159 test files and failed after `test/ui.test.tsx` hung and `test/upgrade.test.ts` failed; this is baseline evidence only and was not modified during the gate.

## Behavior comparison

### Diff and visual quality

Reviewbench now has one real renderer path: Pierre parses patches and unsaved buffers, Shiki applies content-addressed themes and exact TextMate scope overrides, Pierre marks changed words, and the framework-neutral plan owns split/stack rows, terminal-cell wrapping, line gutters, folds, exact note anchors, row offsets, and a 10,000-row work bound. Solid only projects that plan into OpenTUI elements. Unit, off-screen UI, compiled PTY, and Namespace CI proofs pass.

Hunk remains the quality ceiling. It additionally has source-backed partial-diff highlighting, interactive context expansion, mature review-stream windowing and scrolling, horizontal reveal, move styling, richer selection/copy behavior, and substantially deeper PTY coverage.

Druk remains the shell/editor ceiling. Its native OpenTUI diff supports unified/split display, Tree-sitter source highlighting, unsaved buffers, hatching for padded split cells, and explicit large-file cutoffs. It does not provide Pierre word-level emphasis or Hunk's exact agent annotation geometry.

### Agent behavior

Reviewbench's live host accepts the existing Hunk CLI compatibility actions `list`, `get`, `context`, `review`, `navigate`, `comment-add`, `comment-list`, and `comment-rm`. A real installed Hunk CLI completed list/context/navigation/comment add/list/remove against the compiled Reviewbench host. Project loading and rendering now derive the same stable hunk identities.

Hunk still exposes the broader mature surface: reload, review-workspace add/select/rename/close, batch comment apply, deeper focus/navigation behavior, and multi-session PTY coverage. Reviewbench's product-neutral protocol models these boundaries, but the current host deliberately does not advertise unimplemented actions.

Druk has local review notes, read-only forge comment fetching, and prompt-oriented export, but no daemon-controlled agent session contract.

## Explicit remaining gates

Reviewbench does not claim Hunk parity yet. Before Hunk can stop being the fallback, later visible slices must prove:

1. a multi-file continuous review stream with exact keyboard and mouse navigation;
2. source-backed partial highlighting and interactive context expansion without duplicate geometry;
3. bounded windowing, horizontal reveal, selection, and copy behavior on realistic large diffs;
4. the remaining reload, review-workspace, and batch-note host capabilities through the existing CLI;
5. packed/installed acceptance and an explicit Hunk retirement decision.

The operator chooses the next slice after running the current checkpoint with `mise run demo`; this gate does not silently authorize an autonomous chain through all five.
