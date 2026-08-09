import { createSignal } from "solid-js";
import type { SidebarView } from "../core/shell";

export type { SidebarView } from "../core/shell";

/** Own sidebar view and cursor independently from document-tab state. */
export function createSidebar(initial: SidebarView = "files") {
  const [view, setView] = createSignal<SidebarView>(initial);
  const [cursor, setCursor] = createSignal(0);

  const selectView = (next: SidebarView) => {
    setView(next);
    setCursor(0);
  };

  return { view, cursor, setCursor, selectView };
}

export type SidebarController = ReturnType<typeof createSidebar>;
