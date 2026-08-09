import { type ScrollBoxRenderable, TextAttributes } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/solid";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { createEffect, createMemo, For, onMount, Show } from "solid-js";
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

function sourceBadge(source: ReviewWorkspaceInfo["source"]) {
  switch (source.kind) {
    case "working-tree":
      return source.staged ? "STAGED" : "WORKING TREE";
    case "commit":
      return "COMMIT";
    case "stash":
      return "STASH";
    case "file-pair":
      return "FILE PAIR";
    case "patch":
      return "PATCH";
    case "external-diff":
      return "EXTERNAL DIFF";
  }
  source satisfies never;
  throw new Error("Unsupported review source.");
}

/**
 * Druk-derived composition root: controllers are created once in dependency order,
 * while presentational UI receives only reactive values and callbacks.
 */
export function App(props: AppProps) {
  const renderer = useRenderer();
  let reviewScroll: ScrollBoxRenderable | undefined;
  const settings = createSettings(props.settings);
  const workspace = createWorkspace(props.workspace, props.state);
  const sidebar = createSidebar();
  const history = createHistory(props.history ?? []);
  const review = createReview(props.state);
  const host = createReviewbenchHost({ workspace, review });
  const colors = createMemo(() => colorsFor(settings.settings.theme));
  const additions = createMemo(() =>
    props.workspace.documents.reduce((total, document) => total + document.additions, 0),
  );
  const deletions = createMemo(() =>
    props.workspace.documents.reduce((total, document) => total + document.deletions, 0),
  );
  const sidebarWidth = createMemo(() =>
    Math.min(settings.settings.sidebarWidth, Math.max(18, Math.floor(renderer.width * 0.24))),
  );
  const reviewWidth = createMemo(() =>
    Math.max(40, renderer.width - (settings.settings.sidebarVisible ? sidebarWidth() : 0)),
  );
  const footerHints = createMemo(() => {
    const hints = [
      { key: "[ / ]", label: "hunks" },
      { key: ", / .", label: "files" },
    ];
    if (renderer.width >= 78) hints.push({ key: "s", label: "sidebar" });
    if (renderer.width >= 104) hints.push({ key: "0 / 1 / 2", label: "layout" });
    if (renderer.width >= 126) hints.push({ key: "t", label: "theme" });
    if (renderer.width >= 140) hints.push({ key: "w", label: "wrap" });
    hints.push({ key: "q", label: "quit" });
    return hints;
  });

  onMount(() => props.onHostReady?.(host));
  createEffect(() => {
    const state = host.snapshot().workspaces[0];
    if (state) props.onSnapshot?.(state);
  });

  const scrollReview = (delta: number, unit: "absolute" | "viewport" | "content") => {
    if (!reviewScroll) return;
    reviewScroll.scrollBy(delta, unit);
  };

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      key.stopPropagation();
      renderer.destroy();
      return;
    }

    const chord = key.sequence && key.sequence.length === 1 ? key.sequence : key.name;
    if (key.shift && chord === " ") {
      scrollReview(-1, "viewport");
      key.preventDefault();
      key.stopPropagation();
      return;
    }
    switch (chord) {
      case "q":
        renderer.destroy();
        break;
      case "G":
      case "end":
        scrollReview(1, "content");
        break;
      case "g":
      case "home":
        scrollReview(-1, "content");
        break;
      case "pagedown":
      case " ":
      case "f":
        scrollReview(1, "viewport");
        break;
      case "pageup":
      case "b":
        scrollReview(-1, "viewport");
        break;
      case "d":
        scrollReview(Math.max(1, Math.floor((reviewScroll?.viewport.height ?? 1) / 2)), "absolute");
        break;
      case "u":
        scrollReview(
          -Math.max(1, Math.floor((reviewScroll?.viewport.height ?? 1) / 2)),
          "absolute",
        );
        break;
      case "down":
      case "j":
        scrollReview(1, "absolute");
        break;
      case "up":
      case "k":
        scrollReview(-1, "absolute");
        break;
      case "s":
        settings.toggleSidebar();
        break;
      case "t":
        settings.toggleTheme();
        break;
      case "w":
        settings.toggleWrap();
        break;
      case "0":
        settings.selectLayout("auto");
        break;
      case "1":
        settings.selectLayout("split");
        break;
      case "2":
        settings.selectLayout("stack");
        break;
      case ",":
        workspace.moveDocument(-1);
        break;
      case ".":
        workspace.moveDocument(1);
        break;
      case "[":
        workspace.moveHunk(-1);
        break;
      case "]":
        workspace.moveHunk(1);
        break;
      default:
        return;
    }
    key.preventDefault();
    key.stopPropagation();
  });

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors().bg}>
      <box
        height={1}
        flexDirection="row"
        flexShrink={0}
        alignItems="center"
        backgroundColor={colors().bar}
      >
        <text
          fg={colors().accent}
          bg={colors().bar}
          content=" Reviewbench"
          flexShrink={0}
          attributes={TextAttributes.BOLD}
        />
        <text fg={colors().faint} bg={colors().bar} content="  /  " flexShrink={0} />
        <text
          fg={colors().text}
          bg={colors().bar}
          content={props.workspace.name}
          wrapMode="none"
          flexShrink={1}
          attributes={TextAttributes.BOLD}
        />
        <box flexGrow={1} backgroundColor={colors().bar} />
        <text
          fg={colors().text}
          bg={colors().accentMuted}
          content={` ${sourceBadge(props.workspace.source)} `}
          wrapMode="none"
          flexShrink={0}
          attributes={TextAttributes.BOLD}
        />
        <text
          fg={colors().dim}
          bg={colors().bar}
          content={` ${props.workspace.documents.length} files  `}
          wrapMode="none"
          flexShrink={0}
        />
        <text
          fg={colors().added}
          bg={colors().bar}
          content={`+${additions()}`}
          wrapMode="none"
          flexShrink={0}
        />
        <text
          fg={colors().deleted}
          bg={colors().bar}
          content={` -${deletions()} `}
          wrapMode="none"
          flexShrink={0}
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
            width={sidebarWidth()}
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
          documents={workspace.documents}
          activeDocumentId={workspace.activeDocumentId()}
          sidebarView={sidebar.view()}
          selectedHistory={history.selected()}
          selectedNote={review.selectedNote()}
          notes={review.notes()}
          width={reviewWidth()}
          wrap={settings.settings.wrap}
          theme={settings.settings.theme}
          layout={settings.settings.layout}
          selectedHunkId={workspace.selectedHunkId()}
          revealRequestId={workspace.revealRequestId()}
          colors={colors()}
          onSelectTarget={workspace.navigate}
          onViewportTarget={workspace.syncViewport}
          onScrollReady={(scrollBox) => {
            reviewScroll = scrollBox;
          }}
        />
      </box>
      <box height={1} flexDirection="row" flexShrink={0} backgroundColor={colors().bar}>
        <For each={footerHints()}>
          {(hint) => (
            <box flexDirection="row" flexShrink={0} paddingLeft={1} backgroundColor={colors().bar}>
              <text fg={colors().accent} bg={colors().bar} content={`${hint.key} `} />
              <text fg={colors().faint} bg={colors().bar} content={hint.label} />
            </box>
          )}
        </For>
        <box flexGrow={1} backgroundColor={colors().bar} />
        <text
          fg={colors().dim}
          bg={colors().bar}
          content={` ${props.workspace.documents.length} files · ${review.notes().length} notes `}
          wrapMode="none"
          flexShrink={0}
        />
      </box>
    </box>
  );
}
