import { TextAttributes } from "@opentui/core";
import type {
  ReviewDocument,
  ReviewNote,
  ReviewSource,
} from "@victor-software-house/reviewbench-protocol";
import { For, Show } from "solid-js";
import type { GitHistoryEntry, SidebarView } from "../core/shell";
import type { ShellColors } from "./theme";

interface SidebarProps {
  width: number;
  view: SidebarView;
  colors: ShellColors;
  documents: ReviewDocument[];
  activeDocumentId: string | null;
  source: ReviewSource;
  sourceLabel: string;
  history: GitHistoryEntry[];
  selectedHistoryId: string | null;
  notes: ReviewNote[];
  selectedNoteId: string | null;
  onView: (view: SidebarView) => void;
  onDocument: (id: string) => void;
  onHistory: (id: string) => void;
  onNote: (id: string) => void;
}

const views: Array<{ id: SidebarView; label: string; short: string }> = [
  { id: "files", label: "Files", short: "F" },
  { id: "git", label: "Git", short: "G" },
  { id: "history", label: "Hist", short: "H" },
  { id: "notes", label: "Notes", short: "N" },
];

const pathSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function fitText(text: string, width: number) {
  if (width <= 0) return "";
  if (Bun.stringWidth(text) <= width) return text;
  const graphemes = Array.from(pathSegmenter.segment(text), (part) => part.segment);
  while (graphemes.length > 0 && Bun.stringWidth(`${graphemes.join("")}…`) > width) {
    graphemes.pop();
  }
  return `${graphemes.join("")}…`;
}

function fileState(document: ReviewDocument) {
  if (document.additions > 0 && document.deletions > 0) return "M";
  if (document.additions > 0) return "A";
  if (document.deletions > 0) return "D";
  return "·";
}

function sourceKind(source: ReviewSource) {
  switch (source.kind) {
    case "working-tree":
      return source.staged ? "staged working tree" : "working tree";
    case "commit":
      return `commit ${source.ref ?? "HEAD"}`;
    case "stash":
      return `stash ${source.ref ?? "latest"}`;
    case "file-pair":
      return "file comparison";
    case "patch":
      return "patch";
    case "external-diff":
      return "external diff";
  }
  source satisfies never;
  throw new Error("Unsupported review source.");
}

/** Compact review navigation; the main pane remains the authoritative review surface. */
export function Sidebar(props: SidebarProps) {
  const rowBackground = (selected: boolean) =>
    selected ? props.colors.selected : props.colors.panel;
  const totalAdditions = () =>
    props.documents.reduce((sum, document) => sum + document.additions, 0);
  const totalDeletions = () =>
    props.documents.reduce((sum, document) => sum + document.deletions, 0);

  return (
    <box
      width={props.width}
      flexShrink={0}
      flexDirection="column"
      backgroundColor={props.colors.panel}
    >
      <box height={1} flexDirection="row" flexShrink={0} backgroundColor={props.colors.bar}>
        <For each={views}>
          {(entry) => {
            const active = () => props.view === entry.id;
            return (
              <box
                paddingLeft={1}
                flexShrink={0}
                backgroundColor={active() ? props.colors.accentMuted : props.colors.bar}
                onMouseDown={() => props.onView(entry.id)}
              >
                <text
                  fg={active() ? props.colors.text : props.colors.dim}
                  bg={active() ? props.colors.accentMuted : props.colors.bar}
                  content={props.width >= 22 ? entry.label : entry.short}
                  attributes={active() ? TextAttributes.BOLD : TextAttributes.NONE}
                />
              </box>
            );
          }}
        </For>
        <box flexGrow={1} backgroundColor={props.colors.bar} />
      </box>

      <Show when={props.view === "files"}>
        <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.panel}>
          <box height={1} flexDirection="row" backgroundColor={props.colors.panelAlt}>
            <text
              fg={props.colors.faint}
              bg={props.colors.panelAlt}
              content={` CHANGES  ${props.documents.length} files`}
              wrapMode="none"
            />
            <box flexGrow={1} backgroundColor={props.colors.panelAlt} />
          </box>
          <For each={props.documents}>
            {(document) => {
              const selected = () => document.id === props.activeDocumentId;
              const state = () => fileState(document);
              const stats = () =>
                [
                  document.additions > 0 ? `+${document.additions}` : "",
                  document.deletions > 0 ? `-${document.deletions}` : "",
                ]
                  .filter(Boolean)
                  .join(" ");
              const pathWidth = () => Math.max(1, props.width - Bun.stringWidth(stats()) - 6);
              const stateColor = () =>
                state() === "D"
                  ? props.colors.deleted
                  : state() === "A"
                    ? props.colors.added
                    : props.colors.warning;
              return (
                <box
                  height={1}
                  flexDirection="row"
                  backgroundColor={rowBackground(selected())}
                  onMouseDown={() => props.onDocument(document.id)}
                >
                  <text
                    fg={props.colors.accent}
                    bg={rowBackground(selected())}
                    content={selected() ? "▎" : " "}
                    flexShrink={0}
                  />
                  <text
                    fg={stateColor()}
                    bg={rowBackground(selected())}
                    content={`${state()}  `}
                    flexShrink={0}
                    attributes={TextAttributes.BOLD}
                  />
                  <text
                    fg={selected() ? props.colors.text : props.colors.dim}
                    bg={rowBackground(selected())}
                    content={fitText(document.path, pathWidth())}
                    wrapMode="none"
                    flexShrink={1}
                    attributes={selected() ? TextAttributes.BOLD : TextAttributes.NONE}
                  />
                  <box flexGrow={1} backgroundColor={rowBackground(selected())} />
                  <text
                    fg={props.colors.faint}
                    bg={rowBackground(selected())}
                    content={stats() ? ` ${stats()} ` : " "}
                    wrapMode="none"
                    flexShrink={0}
                  />
                </box>
              );
            }}
          </For>
        </box>
      </Show>

      <Show when={props.view === "git"}>
        <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.panel}>
          <text fg={props.colors.faint} bg={props.colors.panelAlt} content=" COMPARISON" />
          <box
            flexDirection="column"
            paddingLeft={1}
            paddingTop={1}
            backgroundColor={props.colors.panel}
          >
            <text fg={props.colors.text} bg={props.colors.panel} content={props.sourceLabel} />
            <text
              fg={props.colors.dim}
              bg={props.colors.panel}
              content={sourceKind(props.source)}
            />
            <box flexDirection="row" backgroundColor={props.colors.panel}>
              <text
                fg={props.colors.added}
                bg={props.colors.panel}
                content={`+${totalAdditions()}`}
              />
              <text
                fg={props.colors.deleted}
                bg={props.colors.panel}
                content={`  -${totalDeletions()}`}
              />
            </box>
          </box>
        </box>
      </Show>

      <Show when={props.view === "history"}>
        <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.panel}>
          <text fg={props.colors.faint} bg={props.colors.panelAlt} content=" COMMITS" />
          <Show
            when={props.history.length > 0}
            fallback={
              <text fg={props.colors.faint} bg={props.colors.panel} content=" no history" />
            }
          >
            <For each={props.history}>
              {(entry) => {
                const selected = () => entry.id === props.selectedHistoryId;
                return (
                  <box
                    height={2}
                    flexDirection="column"
                    backgroundColor={rowBackground(selected())}
                    onMouseDown={() => props.onHistory(entry.id)}
                  >
                    <text
                      fg={selected() ? props.colors.text : props.colors.dim}
                      bg={rowBackground(selected())}
                      content={` ${entry.id.slice(0, 7)} ${entry.subject}`}
                      wrapMode="none"
                    />
                    <text
                      fg={props.colors.faint}
                      bg={rowBackground(selected())}
                      content={`   ${entry.author} · ${entry.relativeDate}`}
                      wrapMode="none"
                    />
                  </box>
                );
              }}
            </For>
          </Show>
        </box>
      </Show>

      <Show when={props.view === "notes"}>
        <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.panel}>
          <text fg={props.colors.faint} bg={props.colors.panelAlt} content=" REVIEW NOTES" />
          <Show
            when={props.notes.length > 0}
            fallback={<text fg={props.colors.faint} bg={props.colors.panel} content=" no notes" />}
          >
            <For each={props.notes}>
              {(note) => {
                const selected = () => note.id === props.selectedNoteId;
                return (
                  <box
                    height={2}
                    flexDirection="column"
                    backgroundColor={rowBackground(selected())}
                    onMouseDown={() => props.onNote(note.id)}
                  >
                    <text
                      fg={note.source === "user" ? props.colors.warning : props.colors.accent}
                      bg={rowBackground(selected())}
                      content={` ${note.source.toUpperCase()} ${note.summary}`}
                      wrapMode="none"
                    />
                    <text
                      fg={props.colors.faint}
                      bg={rowBackground(selected())}
                      content={`   ${note.documentId}`}
                      wrapMode="none"
                    />
                  </box>
                );
              }}
            </For>
          </Show>
        </box>
      </Show>
    </box>
  );
}
