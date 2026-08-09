import type { ScrollBoxRenderable } from "@opentui/core";
import {
  REVIEWBENCH_DARK_THEME,
  REVIEWBENCH_LIGHT_THEME,
} from "@victor-software-house/reviewbench-diff-engine";
import type { ReviewDocument, ReviewNote } from "@victor-software-house/reviewbench-protocol";
import { For, Show } from "solid-js";
import type { GitHistoryEntry, SidebarView } from "../core/shell";
import { ReviewStream } from "./ReviewStream";
import type { ShellColors } from "./theme";

interface ReviewPaneProps {
  documents: readonly ReviewDocument[];
  activeDocumentId: string | null;
  sidebarView: SidebarView;
  selectedHistory: GitHistoryEntry | null;
  selectedNote: ReviewNote | null;
  notes: readonly ReviewNote[];
  width: number;
  wrap: boolean;
  theme: "dark" | "light";
  layout: "auto" | "split" | "stack";
  selectedHunkId: string | null;
  revealRequestId: number;
  colors: ShellColors;
  onSelectTarget: (documentId: string, hunkId?: string) => void;
  onViewportTarget: (documentId: string, hunkId?: string) => void;
  onScrollReady: (scrollBox: ScrollBoxRenderable | undefined) => void;
}

/** Review surface with history/note detail modes and one continuous changed-file stream. */
export function ReviewPane(props: ReviewPaneProps) {
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.bg}>
      <Show when={props.sidebarView === "history" && props.selectedHistory}>
        <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={props.colors.panelAlt}>
          <text fg={props.colors.faint} bg={props.colors.panelAlt} content="COMMIT DETAIL" />
        </box>
        <box flexDirection="column" padding={1} backgroundColor={props.colors.bg}>
          <text
            fg={props.colors.accent}
            bg={props.colors.bg}
            content={props.selectedHistory?.subject ?? ""}
          />
          <text
            fg={props.colors.dim}
            bg={props.colors.bg}
            content={`${props.selectedHistory?.author ?? ""} · ${props.selectedHistory?.relativeDate ?? ""}`}
          />
          <For each={props.selectedHistory?.refs ?? []}>
            {(ref) => <text fg={props.colors.warning} bg={props.colors.bg} content={`◆ ${ref}`} />}
          </For>
        </box>
      </Show>

      <Show when={props.sidebarView === "notes" && props.selectedNote}>
        <box height={1} flexDirection="row" paddingLeft={1} backgroundColor={props.colors.panelAlt}>
          <text fg={props.colors.faint} bg={props.colors.panelAlt} content="NOTE DETAIL" />
        </box>
        <box flexDirection="column" padding={1} backgroundColor={props.colors.bg}>
          <text
            fg={props.colors.accent}
            bg={props.colors.bg}
            content={props.selectedNote?.summary ?? ""}
          />
          <text
            fg={props.colors.text}
            bg={props.colors.bg}
            content={props.selectedNote?.body ?? props.selectedNote?.markup ?? ""}
          />
          <text
            fg={props.colors.faint}
            bg={props.colors.bg}
            content={props.selectedNote?.documentId ?? ""}
          />
        </box>
      </Show>

      <Show when={props.sidebarView !== "history" && props.sidebarView !== "notes"}>
        <Show
          when={props.documents.length > 0}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center">
              <text fg={props.colors.faint} bg={props.colors.bg} content="No changed documents" />
            </box>
          }
        >
          <ReviewStream
            documents={props.documents}
            notes={props.notes}
            width={Math.max(1, props.width - 2)}
            wrap={props.wrap}
            layout={props.layout}
            activeDocumentId={props.activeDocumentId}
            selectedHunkId={props.selectedHunkId}
            revealRequestId={props.revealRequestId}
            colors={props.colors}
            theme={props.theme === "dark" ? REVIEWBENCH_DARK_THEME : REVIEWBENCH_LIGHT_THEME}
            onSelectTarget={props.onSelectTarget}
            onViewportTarget={props.onViewportTarget}
            onScrollReady={props.onScrollReady}
          />
        </Show>
      </Show>
    </box>
  );
}
