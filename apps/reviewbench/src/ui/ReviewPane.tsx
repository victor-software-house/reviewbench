import {
  REVIEWBENCH_DARK_THEME,
  REVIEWBENCH_LIGHT_THEME,
} from "@victor-software-house/reviewbench-diff-engine";
import type { ReviewDocument, ReviewNote } from "@victor-software-house/reviewbench-protocol";
import { For, Show } from "solid-js";
import type { GitHistoryEntry, SidebarView } from "../core/shell";
import { DiffView } from "./DiffView";
import type { ShellColors } from "./theme";

interface ReviewPaneProps {
  document: ReviewDocument | null;
  sidebarView: SidebarView;
  selectedHistory: GitHistoryEntry | null;
  selectedNote: ReviewNote | null;
  notes: readonly ReviewNote[];
  width: number;
  wrap: boolean;
  theme: "dark" | "light";
  layout: "auto" | "split" | "stack";
  selectedHunkId: string | null;
  colors: ShellColors;
}

/** Review surface with one fixed file summary over the shared diff-plan renderer. */
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
          when={props.document}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center">
              <text fg={props.colors.faint} bg={props.colors.bg} content="No document selected" />
            </box>
          }
        >
          {(document) => (
            <>
              <box
                height={1}
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={props.colors.panelAlt}
              >
                <text
                  fg={props.colors.text}
                  bg={props.colors.panelAlt}
                  content={document().path}
                  wrapMode="none"
                />
                <box flexGrow={1} backgroundColor={props.colors.panelAlt} />
                <text
                  fg={props.colors.added}
                  bg={props.colors.panelAlt}
                  content={`+${document().additions}`}
                  flexShrink={0}
                />
                <text
                  fg={props.colors.deleted}
                  bg={props.colors.panelAlt}
                  content={`  -${document().deletions}`}
                  flexShrink={0}
                />
                <text
                  fg={props.colors.faint}
                  bg={props.colors.panelAlt}
                  content={`  ${document().hunkCount} ${document().hunkCount === 1 ? "hunk" : "hunks"}`}
                  flexShrink={0}
                />
              </box>
              <scrollbox flexGrow={1} backgroundColor={props.colors.bg}>
                <box flexDirection="column" paddingLeft={1} paddingRight={1}>
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
                      width={Math.max(1, props.width - 2)}
                      wrap={props.wrap}
                      layout={props.layout}
                      selectedHunkId={props.selectedHunkId}
                      theme={
                        props.theme === "dark" ? REVIEWBENCH_DARK_THEME : REVIEWBENCH_LIGHT_THEME
                      }
                    />
                  </Show>
                </box>
              </scrollbox>
            </>
          )}
        </Show>
      </Show>
    </box>
  );
}
