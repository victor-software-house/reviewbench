import type {
  DiffCellPlan,
  DiffPlanRow,
  DiffRenderPlan,
  DiffSpan,
  DiffTheme,
} from "@victor-software-house/reviewbench-diff-engine";
import { For, Match, Show, Switch } from "solid-js";

interface DiffViewProps {
  plan: DiffRenderPlan;
  wrap: boolean;
  theme: DiffTheme;
  selectedHunkId: string | null;
  onSelectTarget?: ((documentId: string, hunkId: string) => void) | undefined;
}

/** Stable OpenTUI identity for one planned diff row inside the continuous stream. */
export function reviewStreamRowId(documentId: string, rowKey: string) {
  return `review-stream-row:${documentId}:${rowKey}`;
}

function lineBackground(cell: DiffCellPlan, theme: DiffTheme) {
  if (cell.kind === "addition") return theme.additionBackground;
  if (cell.kind === "deletion") return theme.deletionBackground;
  return theme.contextBackground;
}

function lineForeground(cell: DiffCellPlan, theme: DiffTheme) {
  if (cell.kind === "addition") return theme.additionSign;
  if (cell.kind === "deletion") return theme.deletionSign;
  return theme.muted;
}

function StyledSpans(props: {
  spans: readonly DiffSpan[];
  foreground: string;
  background: string;
}) {
  return (
    <For each={props.spans}>
      {(span) => {
        const style = {
          fg: span.fg ?? props.foreground,
          bg: span.bg ?? props.background,
        };
        return <span {...style}>{span.text}</span>;
      }}
    </For>
  );
}

function StackCell(props: { cell: DiffCellPlan; digits: number; wrap: boolean; theme: DiffTheme }) {
  const background = () => lineBackground(props.cell, props.theme);
  const foreground = () => lineForeground(props.cell, props.theme);
  const oldLine = () => String(props.cell.oldLine ?? "").padStart(props.digits);
  const newLine = () => String(props.cell.newLine ?? "").padStart(props.digits);
  return (
    <box height={props.cell.height} flexDirection="row" backgroundColor={background()}>
      <text
        width={props.digits + 1}
        flexShrink={0}
        fg={props.theme.muted}
        bg={background()}
        content={`${oldLine()} `}
      />
      <text
        width={props.digits + 1}
        flexShrink={0}
        fg={props.theme.muted}
        bg={background()}
        content={`${newLine()} `}
      />
      <text
        width={2}
        flexShrink={0}
        fg={foreground()}
        bg={background()}
        content={`${props.cell.sign} `}
      />
      <text
        fg={props.theme.foreground}
        bg={background()}
        wrapMode={props.wrap ? "char" : "none"}
        flexGrow={1}
      >
        <StyledSpans
          spans={props.cell.spans}
          foreground={props.theme.foreground}
          background={background()}
        />
      </text>
    </box>
  );
}

function SplitCell(props: {
  cell: DiffCellPlan;
  height: number;
  digits: number;
  wrap: boolean;
  theme: DiffTheme;
}) {
  const background = () => lineBackground(props.cell, props.theme);
  const foreground = () => lineForeground(props.cell, props.theme);
  const line = () => props.cell.oldLine ?? props.cell.newLine;
  return (
    <box
      height={props.height}
      flexGrow={1}
      flexBasis={0}
      flexDirection="row"
      backgroundColor={background()}
    >
      <text
        width={props.digits + 1}
        flexShrink={0}
        fg={props.theme.muted}
        bg={background()}
        content={`${String(line() ?? "").padStart(props.digits)} `}
      />
      <text
        width={2}
        flexShrink={0}
        fg={foreground()}
        bg={background()}
        content={`${props.cell.sign} `}
      />
      <text
        fg={props.theme.foreground}
        bg={background()}
        wrapMode={props.wrap ? "char" : "none"}
        flexGrow={1}
      >
        <StyledSpans
          spans={props.cell.spans}
          foreground={props.theme.foreground}
          background={background()}
        />
      </text>
    </box>
  );
}

function PlannedRow(props: {
  row: DiffPlanRow;
  plan: DiffRenderPlan;
  wrap: boolean;
  theme: DiffTheme;
  selectedHunkId: string | null;
}) {
  const selected = () => "hunkId" in props.row && props.row.hunkId === props.selectedHunkId;
  const metadataBackground = () =>
    selected() ? props.theme.selectedHunkBackground : props.theme.hunkBackground;
  return (
    <Switch>
      <Match when={props.row.type === "fold"}>
        <text
          fg={props.theme.muted}
          bg={metadataBackground()}
          content={`  ⋯ ${props.row.type === "fold" ? props.row.text : ""}`}
        />
      </Match>
      <Match when={props.row.type === "hunk"}>
        <text
          fg={selected() ? props.theme.foreground : props.theme.muted}
          bg={metadataBackground()}
          content={`${selected() ? "▎" : " "} ${props.row.type === "hunk" ? props.row.text : ""}`}
        />
      </Match>
      <Match when={props.row.type === "split"}>
        <Show when={props.row.type === "split" ? props.row : undefined}>
          {(row) => (
            <box height={row().height} flexDirection="row">
              <SplitCell
                cell={row().left}
                height={row().height}
                digits={props.plan.lineNumberWidth}
                wrap={props.wrap}
                theme={props.theme}
              />
              <text fg={props.theme.muted} bg={props.theme.hunkBackground} content="│" />
              <SplitCell
                cell={row().right}
                height={row().height}
                digits={props.plan.lineNumberWidth}
                wrap={props.wrap}
                theme={props.theme}
              />
            </box>
          )}
        </Show>
      </Match>
      <Match when={props.row.type === "stack"}>
        <Show when={props.row.type === "stack" ? props.row : undefined}>
          {(row) => (
            <StackCell
              cell={row().cell}
              digits={props.plan.lineNumberWidth}
              wrap={props.wrap}
              theme={props.theme}
            />
          )}
        </Show>
      </Match>
      <Match when={props.row.type === "note"}>
        <text
          fg={props.theme.noteForeground}
          bg={props.theme.noteBackground}
          content={`  │ ${props.row.type === "note" ? props.row.text : ""}`}
          wrapMode="word"
        />
      </Match>
      <Match when={props.row.type === "truncated"}>
        <text
          fg={props.theme.muted}
          bg={props.theme.hunkBackground}
          content={`  ⋯ ${props.row.type === "truncated" ? props.row.text : ""}`}
        />
      </Match>
    </Switch>
  );
}

/** Thin Solid projection over one framework-neutral section of the review stream. */
export function DiffView(props: DiffViewProps) {
  return (
    <For each={props.plan.rows}>
      {(row) => (
        <box
          id={reviewStreamRowId(props.plan.documentId, row.key)}
          height={row.height}
          flexDirection="column"
          onMouseDown={() => {
            if ("hunkId" in row) props.onSelectTarget?.(props.plan.documentId, row.hunkId);
          }}
        >
          <PlannedRow
            row={row}
            plan={props.plan}
            wrap={props.wrap}
            theme={props.theme}
            selectedHunkId={props.selectedHunkId}
          />
        </box>
      )}
    </For>
  );
}
