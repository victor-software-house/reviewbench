import { createMemo, createSignal } from "solid-js";
import type { GitHistoryEntry } from "../core/shell";

export type { GitHistoryEntry } from "../core/shell";

/** Own the read-only Git history selection surfaced by the minimal shell. */
export function createHistory(entries: GitHistoryEntry[]) {
  const [selectedId, setSelectedId] = createSignal(entries[0]?.id ?? null);
  const selected = createMemo(() => entries.find((entry) => entry.id === selectedId()) ?? null);
  return { entries, selectedId, selected, select: setSelectedId };
}

export type HistoryController = ReturnType<typeof createHistory>;
