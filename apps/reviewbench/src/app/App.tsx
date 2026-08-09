import { useKeyboard, useRenderer } from "@opentui/solid";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { createEffect, createMemo, onMount, Show } from "solid-js";
import { ReviewPane } from "../ui/ReviewPane";
import { Sidebar } from "../ui/Sidebar";
import { Tabs } from "../ui/Tabs";
import { colorsFor } from "../ui/theme";
import { createHistory, type GitHistoryEntry } from "./history";
import { createReviewbenchHost, type ReviewbenchHost } from "./host";
import { createReview } from "./review";
import { createSettings, type ShellSettings } from "./settings";
import { createSidebar } from "./sidebar";
import { createWorkspace } from "./workspace";

export interface AppProps {
  workspace: ReviewWorkspaceInfo;
  state: ReviewWorkspaceState;
  history?: GitHistoryEntry[] | undefined;
  settings?: Partial<ShellSettings> | undefined;
  onHostReady?: ((host: ReviewbenchHost) => void) | undefined;
  onSnapshot?: ((state: ReviewWorkspaceState) => void) | undefined;
}

/**
 * Druk-derived composition root: controllers are created once in dependency order,
 * while presentational UI receives only reactive values and callbacks.
 */
export function App(props: AppProps) {
  const renderer = useRenderer();
  const settings = createSettings(props.settings);
  const workspace = createWorkspace(props.workspace, props.state);
  const sidebar = createSidebar();
  const history = createHistory(props.history ?? []);
  const review = createReview(props.state);
  const host = createReviewbenchHost({ workspace, review });
  const colors = createMemo(() => colorsFor(settings.settings.theme));

  onMount(() => props.onHostReady?.(host));
  createEffect(() => {
    const state = host.snapshot().workspaces[0];
    if (state) props.onSnapshot?.(state);
  });

  useKeyboard((key) => {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) renderer.destroy();
    if (key.name === "1") sidebar.selectView("files");
    if (key.name === "2") sidebar.selectView("git");
    if (key.name === "3") sidebar.selectView("history");
    if (key.name === "4") sidebar.selectView("notes");
    if (key.name === "b") settings.toggleSidebar();
    if (key.name === "t") settings.toggleTheme();
    if (key.name === "w") settings.toggleWrap();
  });

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors().bg}>
      <box
        height={1}
        flexDirection="row"
        flexShrink={0}
        paddingLeft={1}
        backgroundColor={colors().bar}
      >
        <text fg={colors().accent} bg={colors().bar} content="Reviewbench" flexShrink={0} />
        <text
          fg={colors().dim}
          bg={colors().bar}
          content={`  ${props.workspace.name}  ·  ${props.workspace.cwd}`}
          wrapMode="none"
          flexShrink={1}
        />
      </box>
      <Tabs
        tabs={workspace.tabs()}
        activeId={workspace.activeDocumentId()}
        colors={colors()}
        onSelect={workspace.openDocument}
        onClose={workspace.closeDocument}
      />
      <box flexDirection="row" flexGrow={1} backgroundColor={colors().bg}>
        <Show when={settings.settings.sidebarVisible}>
          <Sidebar
            width={settings.settings.sidebarWidth}
            view={sidebar.view()}
            colors={colors()}
            documents={workspace.documents}
            activeDocumentId={workspace.activeDocumentId()}
            source={props.workspace.source}
            sourceLabel={props.workspace.sourceLabel}
            history={history.entries}
            selectedHistoryId={history.selectedId()}
            notes={review.notes()}
            selectedNoteId={review.selectedNoteId()}
            onView={sidebar.selectView}
            onDocument={workspace.openDocument}
            onHistory={history.select}
            onNote={review.selectNote}
          />
        </Show>
        <ReviewPane
          workspace={props.workspace}
          document={workspace.activeDocument()}
          sidebarView={sidebar.view()}
          selectedHistory={history.selected()}
          selectedNote={review.selectedNote()}
          wrap={settings.settings.wrap}
          colors={colors()}
        />
      </box>
      <box height={1} flexDirection="row" flexShrink={0} backgroundColor={colors().bar}>
        <text
          fg={colors().dim}
          bg={colors().bar}
          content=" 1 Files  2 Git  3 History  4 Notes  b Sidebar  t Theme  w Wrap  Esc Quit"
          wrapMode="none"
        />
        <box flexGrow={1} backgroundColor={colors().bar} />
        <text
          fg={colors().faint}
          bg={colors().bar}
          content={` ${props.workspace.documents.length} files · ${review.notes().length} notes `}
          wrapMode="none"
        />
      </box>
    </box>
  );
}
