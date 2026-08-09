import {
  REVIEWBENCH_DARK_THEME,
  REVIEWBENCH_LIGHT_THEME,
} from "@victor-software-house/reviewbench-diff-engine";
import type {
  ReviewDocument,
  ReviewNote,
  ReviewWorkspaceInfo,
} from "@victor-software-house/reviewbench-protocol";
import { For, Show } from "solid-js";
import type { GitHistoryEntry, SidebarView } from "../core/shell";
import { DiffView } from "./DiffView";
import type { ShellColors } from "./theme";

interface ReviewPaneProps {
  workspace: ReviewWorkspaceInfo;
  document: ReviewDocument | null;
  sidebarView: SidebarView;
  selectedHistory: GitHistoryEntry | null;
  selectedNote: ReviewNote | null;
  notes: readonly ReviewNote[];
  width: number;
  wrap: boolean;
  theme: "dark" | "light";
  colors: ShellColors;
}

/** Review surface with non-diff views around one shared diff-plan renderer path. */
export function ReviewPane(props: ReviewPaneProps) {
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.bg}>
      <box height={2} flexDirection="column" paddingLeft={1} backgroundColor={props.colors.bg}>
        <text fg={props.colors.text} bg={props.colors.bg} content={props.workspace.title} />
        <text fg={props.colors.faint} bg={props.colors.bg} content={props.workspace.sourceLabel} />
      </box>

      <Show when={props.sidebarView === "history" && props.selectedHistory}>
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
            {(ref) => <text fg={props.colors.warning} bg={props.colors.bg} content={`● ${ref}`} />}
          </For>
        </box>
      </Show>

      <Show when={props.sidebarView === "notes" && props.selectedNote}>
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
          when={props.document}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center">
              <text fg={props.colors.faint} bg={props.colors.bg} content="No document selected" />
            </box>
          }
        >
          {(document) => (
            <scrollbox flexGrow={1} backgroundColor={props.colors.bg}>
              <box flexDirection="column" paddingLeft={1} paddingRight={1}>
                <text fg={props.colors.text} bg={props.colors.bg} content={document().path} />
                <text
                  fg={props.colors.dim}
                  bg={props.colors.bg}
                  content={`+${document().additions} -${document().deletions} · ${document().hunkCount} hunks`}
                />
                <Show
                  when={document().patch}
                  fallback={
                    <text
                      fg={props.colors.faint}
                      bg={props.colors.bg}
                      content="Patch content was not included in this session snapshot."
                    />
                  }
                >
                  <DiffView
                    document={document()}
                    notes={props.notes}
                    width={props.width}
                    wrap={props.wrap}
                    theme={
                      props.theme === "dark" ? REVIEWBENCH_DARK_THEME : REVIEWBENCH_LIGHT_THEME
                    }
                  />
                </Show>
              </box>
            </scrollbox>
          )}
        </Show>
      </Show>
    </box>
  );
}
