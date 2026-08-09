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

const views: Array<{ id: SidebarView; label: string }> = [
  { id: "files", label: "Files" },
  { id: "git", label: "Git" },
  { id: "history", label: "History" },
  { id: "notes", label: "Notes" },
];

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

/** Minimal Druk-derived sidebar for files, Git comparison, history, and review notes. */
export function Sidebar(props: SidebarProps) {
  const rowBackground = (selected: boolean) =>
    selected ? props.colors.selected : props.colors.panel;

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
                paddingRight={1}
                backgroundColor={active() ? props.colors.selected : props.colors.bar}
                onMouseDown={() => props.onView(entry.id)}
              >
                <text
                  fg={active() ? props.colors.text : props.colors.dim}
                  bg={active() ? props.colors.selected : props.colors.bar}
                  content={entry.label}
                  attributes={active() ? TextAttributes.BOLD : TextAttributes.NONE}
                />
              </box>
            );
          }}
        </For>
      </box>

      <Show when={props.view === "files"}>
        <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.panel}>
          <text fg={props.colors.faint} bg={props.colors.panel} content=" DOCUMENTS" />
          <For each={props.documents}>
            {(document) => {
              const selected = () => document.id === props.activeDocumentId;
              return (
                <box
                  height={1}
                  flexDirection="row"
                  backgroundColor={rowBackground(selected())}
                  onMouseDown={() => props.onDocument(document.id)}
                >
                  <text
                    fg={selected() ? props.colors.accent : props.colors.text}
                    bg={rowBackground(selected())}
                    content={` ${selected() ? "›" : " "} ${document.path}`}
                    wrapMode="none"
                  />
                </box>
              );
            }}
          </For>
        </box>
      </Show>

      <Show when={props.view === "git"}>
        <box flexDirection="column" paddingLeft={1} backgroundColor={props.colors.panel}>
          <text fg={props.colors.faint} bg={props.colors.panel} content=" COMPARISON" />
          <text fg={props.colors.text} bg={props.colors.panel} content={props.sourceLabel} />
          <text fg={props.colors.dim} bg={props.colors.panel} content={sourceKind(props.source)} />
          <text
            fg={props.colors.added}
            bg={props.colors.panel}
            content={`+${props.documents.reduce((sum, file) => sum + file.additions, 0)}`}
          />
          <text
            fg={props.colors.deleted}
            bg={props.colors.panel}
            content={`-${props.documents.reduce((sum, file) => sum + file.deletions, 0)}`}
          />
        </box>
      </Show>

      <Show when={props.view === "history"}>
        <box flexDirection="column" flexGrow={1} backgroundColor={props.colors.panel}>
          <text fg={props.colors.faint} bg={props.colors.panel} content=" COMMITS" />
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
                      fg={selected() ? props.colors.accent : props.colors.text}
                      bg={rowBackground(selected())}
                      content={` ${entry.id.slice(0, 8)} ${entry.subject}`}
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
          <text fg={props.colors.faint} bg={props.colors.panel} content=" REVIEW NOTES" />
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
