/**
 * Framework-neutral adaptation of Hunk's Pierre/Shiki row-planning approach.
 * Hunk is Copyright Ben Vinegar and licensed under the MIT License; see NOTICE.
 */
import {
  cleanLastNewline,
  type FileContents,
  type FileDiffMetadata,
  getFiletypeFromFileName,
  getHighlighterOptions,
  getSharedHighlighter,
  type Hunk,
  parseDiffFromFile,
  parsePatchFiles,
  registerCustomTheme,
  renderDiffWithHighlighter,
} from "@pierre/diffs";
import stringWidth from "string-width";

export const packageIdentity = "diff-engine" as const;

export type DiffLayout = "split" | "stack";
export type DiffLineKind = "context" | "addition" | "deletion" | "empty";
export type DiffSide = "old" | "new";

export interface DiffTheme {
  id: string;
  appearance: "dark" | "light";
  background: string;
  foreground: string;
  muted: string;
  hunkBackground: string;
  selectedHunkBackground: string;
  additionBackground: string;
  additionEmphasis: string;
  additionSign: string;
  deletionBackground: string;
  deletionEmphasis: string;
  deletionSign: string;
  contextBackground: string;
  noteBackground: string;
  noteForeground: string;
  syntaxScopes?: Readonly<Record<string, string>> | undefined;
}

export interface DiffSpan {
  text: string;
  fg?: string | undefined;
  bg?: string | undefined;
  emphasis?: boolean | undefined;
}

export interface DiffCellPlan {
  kind: DiffLineKind;
  sign: " " | "+" | "-";
  oldLine?: number | undefined;
  newLine?: number | undefined;
  spans: DiffSpan[];
  height: number;
}

interface DiffRowBase {
  key: string;
  hunkId: string;
  hunkIndex: number;
  height: number;
}

export type DiffPlanRow =
  | (DiffRowBase & {
      type: "fold";
      text: string;
      oldRange: readonly [number, number];
      newRange: readonly [number, number];
    })
  | (DiffRowBase & { type: "hunk"; text: string })
  | (DiffRowBase & { type: "split"; left: DiffCellPlan; right: DiffCellPlan })
  | (DiffRowBase & { type: "stack"; cell: DiffCellPlan })
  | (DiffRowBase & {
      type: "note";
      noteId: string;
      text: string;
      side?: DiffSide | undefined;
      line?: number | undefined;
    })
  | {
      type: "truncated";
      key: string;
      height: 1;
      text: string;
    };

export interface DiffRenderPlan {
  documentId: string;
  path: string;
  layout: DiffLayout;
  width: number;
  lineNumberWidth: number;
  rows: DiffPlanRow[];
  rowOffsets: number[];
  totalHeight: number;
  truncated: boolean;
  additionCount: number;
  deletionCount: number;
  hunkCount: number;
}

export interface DiffAnnotation {
  id: string;
  summary: string;
  body?: string | undefined;
  hunkId?: string | undefined;
  side?: DiffSide | undefined;
  line?: number | undefined;
}

interface DiffSourcePatch {
  patch: string;
  before?: never;
  after?: never;
}

interface DiffSourceBuffers {
  patch?: never;
  before: string | null;
  after: string | null;
}

export type CreateDiffPlanInput = (DiffSourcePatch | DiffSourceBuffers) & {
  documentId: string;
  path: string;
  layout: DiffLayout;
  width: number;
  wrap: boolean;
  theme: DiffTheme;
  annotations?: readonly DiffAnnotation[] | undefined;
  tabWidth?: number | undefined;
  maxRows?: number | undefined;
};

export interface ReviewDocumentDiffSummary {
  additions: number;
  deletions: number;
  hunkCount: number;
  hunks: Array<{
    id: string;
    index: number;
    header: string;
    oldRange: readonly [number, number];
    newRange: readonly [number, number];
  }>;
}

export const MAX_PLAN_ROWS = 10_000;

export const REVIEWBENCH_DARK_THEME: DiffTheme = {
  id: "reviewbench-dark",
  appearance: "dark",
  background: "#0d1117",
  foreground: "#e6edf3",
  muted: "#8b949e",
  hunkBackground: "#161b22",
  selectedHunkBackground: "#1a2635",
  additionBackground: "#101a14",
  additionEmphasis: "#1f3d2a",
  additionSign: "#56d364",
  deletionBackground: "#1d1416",
  deletionEmphasis: "#4a2226",
  deletionSign: "#ff7b72",
  contextBackground: "#0d1117",
  noteBackground: "#1c2633",
  noteForeground: "#c9d1d9",
  syntaxScopes: {
    comment: "#8b949e",
    keyword: "#ff7b72",
    string: "#a5d6ff",
    "entity.name.function": "#d2a8ff",
    "variable.other.constant": "#79c0ff",
  },
};

export const REVIEWBENCH_LIGHT_THEME: DiffTheme = {
  id: "reviewbench-light",
  appearance: "light",
  background: "#ffffff",
  foreground: "#1f2328",
  muted: "#656d76",
  hunkBackground: "#f6f8fa",
  selectedHunkBackground: "#ddf4ff",
  additionBackground: "#edf8f0",
  additionEmphasis: "#c8efd2",
  additionSign: "#1a7f37",
  deletionBackground: "#fff1f0",
  deletionEmphasis: "#ffd7d5",
  deletionSign: "#cf222e",
  contextBackground: "#ffffff",
  noteBackground: "#ddf4ff",
  noteForeground: "#24292f",
  syntaxScopes: {
    comment: "#6e7781",
    keyword: "#cf222e",
    string: "#0a3069",
    "entity.name.function": "#8250df",
    "variable.other.constant": "#0550ae",
  },
};

type HastNode = ReturnType<typeof renderDiffWithHighlighter>["code"]["deletionLines"][number];

const registeredThemes = new Set<string>();
const highlighterOptions = new Map<string, ReturnType<typeof getHighlighterOptions>>();

/** Strip terminal control strings before measuring or rendering untrusted source text. */
export function sanitizeDiffText(text: string) {
  let sanitized = "";
  for (const character of Bun.stripANSI(text)) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (character === "\t" || (codePoint >= 0x20 && !(codePoint >= 0x7f && codePoint <= 0x9f)))
    ) {
      sanitized += character;
    }
  }
  return sanitized;
}

/** Expand tabs against terminal cells rather than JavaScript string length. */
export function expandDiffTabs(text: string, tabWidth = 4) {
  const width = Math.max(1, Math.floor(tabWidth));
  let column = 0;
  let result = "";
  for (const [index, segment] of sanitizeDiffText(text).split("\t").entries()) {
    if (index > 0) {
      const spaces = width - (column % width);
      result += " ".repeat(spaces);
      column += spaces;
    }
    result += segment;
    column += stringWidth(segment);
  }
  return result;
}

/** Return the number of terminal rows needed for styled text at one code width. */
export function measureWrappedSpans(spans: readonly DiffSpan[], width: number, wrap: boolean) {
  if (!wrap) return 1;
  const cellWidth = Math.max(1, width);
  const contentWidth = spans.reduce((total, span) => total + stringWidth(span.text), 0);
  return Math.max(1, Math.ceil(contentWidth / cellWidth));
}

/** Pick a scroll target that keeps a selected Hunk-derived diff section readable. */
export function computeHunkRevealScrollTop({
  hunkTop,
  hunkHeight,
  preferredTopPadding,
  viewportHeight,
}: {
  hunkTop: number;
  hunkHeight: number;
  preferredTopPadding: number;
  viewportHeight: number;
}) {
  const clampedTop = Math.max(0, hunkTop);
  const clampedHeight = Math.max(0, hunkHeight);
  const clampedViewportHeight = Math.max(0, viewportHeight);
  const desiredTop = Math.max(0, clampedTop - Math.max(0, preferredTopPadding));

  if (clampedViewportHeight === 0) return desiredTop;
  if (clampedHeight <= clampedViewportHeight) {
    const minimumTopForFullHunk = Math.max(0, clampedTop + clampedHeight - clampedViewportHeight);
    return Math.max(desiredTop, minimumTopForFullHunk);
  }
  return desiredTop;
}

/** Format Pierre's parsed hunk without duplicating context already carried by hunkSpecs. */
export function formatHunkHeader(hunk: Hunk) {
  const parsed = hunk.hunkSpecs?.trimEnd();
  if (parsed) return parsed;
  const specs = `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`;
  return hunk.hunkContext ? `${specs} ${hunk.hunkContext}` : specs;
}

/** Produce the exact stable hunk identity shared by plans and the agent protocol. */
export function diffHunkId(documentId: string, hunk: Hunk, index: number) {
  return `${documentId}:hunk:${index}:${hunk.deletionStart}:${hunk.additionStart}`;
}

function parsePatchMetadataFiles(source: string) {
  return parsePatchFiles(source).flatMap((entry) => entry.files);
}

function metadataFromPatch(patch: string, path: string) {
  let files = parsePatchMetadataFiles(patch);
  if (files.length === 0 && patch.trimStart().startsWith("@@")) {
    files = parsePatchMetadataFiles(
      [`diff --git a/${path} b/${path}`, `--- a/${path}`, `+++ b/${path}`, patch, ""].join("\n"),
    );
  }
  const normalizedPath = path.replace(/^\.\//, "");
  return (
    files.find(
      (file) =>
        file.name === normalizedPath ||
        file.prevName === normalizedPath ||
        file.name.endsWith(`/${normalizedPath}`),
    ) ?? files[0]
  );
}

function metadataFromInput(input: CreateDiffPlanInput) {
  if ("patch" in input && input.patch !== undefined) {
    const metadata = metadataFromPatch(input.patch, input.path);
    if (!metadata) throw new Error(`Patch does not contain ${input.path}`);
    return metadata;
  }

  const oldFile: FileContents | null =
    input.before === null
      ? null
      : {
          name: input.path,
          contents: input.before,
          cacheKey: `old:${input.path}:${input.before.length}`,
        };
  const newFile: FileContents | null =
    input.after === null
      ? null
      : {
          name: input.path,
          contents: input.after,
          cacheKey: `new:${input.path}:${input.after.length}`,
        };
  return parseDiffFromFile(oldFile, newFile, { context: 3 });
}

/** Parse patch facts once for exact agent-visible document and hunk summaries. */
export function summarizePatch(
  documentId: string,
  path: string,
  patch: string,
): ReviewDocumentDiffSummary {
  const metadata = metadataFromPatch(patch, path);
  if (!metadata) return { additions: 0, deletions: 0, hunkCount: 0, hunks: [] };
  const hunks = metadata.hunks.map((hunk, index) => ({
    id: diffHunkId(documentId, hunk, index),
    index,
    header: formatHunkHeader(hunk),
    oldRange: [hunk.deletionStart, hunk.deletionCount] as const,
    newRange: [hunk.additionStart, hunk.additionCount] as const,
  }));
  return {
    additions: metadata.hunks.reduce((total, hunk) => total + hunk.additionLines, 0),
    deletions: metadata.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0),
    hunkCount: hunks.length,
    hunks,
  };
}

function themeName(theme: DiffTheme) {
  const source = JSON.stringify({
    id: theme.id,
    appearance: theme.appearance,
    background: theme.background,
    foreground: theme.foreground,
    syntaxScopes: theme.syntaxScopes,
  });
  return `reviewbench-${new Bun.CryptoHasher("sha256").update(source).digest("hex").slice(0, 16)}`;
}

function ensureTheme(theme: DiffTheme) {
  const name = themeName(theme);
  if (registeredThemes.has(name)) return name;
  const settings = [
    { settings: { foreground: theme.foreground, background: theme.background } },
    ...Object.entries(theme.syntaxScopes ?? {}).map(([scope, foreground]) => ({
      scope: [scope],
      settings: { foreground },
    })),
  ];
  registerCustomTheme(name, async () => ({
    name,
    type: theme.appearance,
    colors: {
      "editor.background": theme.background,
      "editor.foreground": theme.foreground,
    },
    settings,
  }));
  registeredThemes.add(name);
  return name;
}

async function highlight(metadata: FileDiffMetadata, theme: DiffTheme) {
  const syntaxTheme = ensureTheme(theme);
  const language = metadata.lang ?? getFiletypeFromFileName(metadata.name) ?? "text";
  const key = `${syntaxTheme}:${language}`;
  const options =
    highlighterOptions.get(key) ?? getHighlighterOptions(language, { theme: syntaxTheme });
  highlighterOptions.set(key, options);
  try {
    const highlighter = await getSharedHighlighter({
      ...options,
      preferredHighlighter: "shiki-wasm",
    });
    const rendered = renderDiffWithHighlighter(metadata, highlighter, {
      theme: syntaxTheme,
      useTokenTransformer: false,
      tokenizeMaxLineLength: 1_000,
      lineDiffType: "word-alt",
      maxLineDiffLength: 10_000,
    });
    return {
      deletion: rendered.code.deletionLines,
      addition: rendered.code.additionLines,
    };
  } catch {
    return { deletion: [], addition: [] };
  }
}

function parseStyle(style: unknown) {
  const values = new Map<string, string>();
  if (typeof style !== "string") return values;
  for (const part of style.split(";")) {
    const index = part.indexOf(":");
    if (index > 0) values.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return values;
}

function mergeSpan(spans: DiffSpan[], span: DiffSpan) {
  if (!span.text) return;
  const previous = spans.at(-1);
  if (
    previous &&
    previous.fg === span.fg &&
    previous.bg === span.bg &&
    previous.emphasis === span.emphasis
  ) {
    previous.text += span.text;
    return;
  }
  spans.push(span);
}

function flattenLine(
  node: HastNode | undefined,
  raw: string | undefined,
  kind: DiffLineKind,
  theme: DiffTheme,
  tabWidth: number,
) {
  const fallback = expandDiffTabs(cleanLastNewline(raw ?? ""), tabWidth);
  if (!node) return fallback ? [{ text: fallback }] : [];
  const spans: DiffSpan[] = [];
  const tokenColor = theme.appearance === "light" ? "--diffs-token-light" : "--diffs-token-dark";
  const emphasisBg = kind === "addition" ? theme.additionEmphasis : theme.deletionEmphasis;
  const visit = (current: HastNode, inherited: Pick<DiffSpan, "fg" | "bg" | "emphasis">) => {
    if (current.type === "text") {
      mergeSpan(spans, {
        text: expandDiffTabs(cleanLastNewline(current.value), tabWidth),
        ...inherited,
      });
      return;
    }
    if (current.type !== "element") return;
    const styles = parseStyle(current.properties?.style);
    const emphasis = Object.hasOwn(current.properties ?? {}, "data-diff-span");
    const next = {
      fg: styles.get(tokenColor) ?? styles.get("color") ?? inherited.fg,
      bg: emphasis ? emphasisBg : inherited.bg,
      emphasis: emphasis || inherited.emphasis,
    };
    for (const child of current.children ?? []) visit(child, next);
  };
  visit(node, {});
  return spans.length > 0 ? spans : fallback ? [{ text: fallback }] : [];
}

function cell(
  kind: DiffLineKind,
  raw: string | undefined,
  highlighted: HastNode | undefined,
  oldLine: number | undefined,
  newLine: number | undefined,
  codeWidth: number,
  input: CreateDiffPlanInput,
) {
  const spans =
    kind === "empty" ? [] : flattenLine(highlighted, raw, kind, input.theme, input.tabWidth ?? 4);
  return {
    kind,
    sign: kind === "addition" ? "+" : kind === "deletion" ? "-" : " ",
    ...(oldLine === undefined ? {} : { oldLine }),
    ...(newLine === undefined ? {} : { newLine }),
    spans,
    height: measureWrappedSpans(spans, codeWidth, input.wrap),
  } satisfies DiffCellPlan;
}

function lineDigits(metadata: FileDiffMetadata) {
  const highest = metadata.hunks.reduce(
    (maximum, hunk) =>
      Math.max(
        maximum,
        hunk.deletionStart + hunk.deletionCount,
        hunk.additionStart + hunk.additionCount,
      ),
    1,
  );
  return String(highest).length;
}

function notesFor(
  annotations: readonly DiffAnnotation[],
  hunkId: string,
  side?: DiffSide,
  line?: number,
) {
  return annotations.filter(
    (note) =>
      note.hunkId === hunkId &&
      (side === undefined
        ? note.side === undefined && note.line === undefined
        : note.side === side && note.line === line),
  );
}

function noteRows(
  notes: readonly DiffAnnotation[],
  hunkId: string,
  hunkIndex: number,
  width: number,
): DiffPlanRow[] {
  return notes.map((note) => {
    const text = note.body ? `${note.summary} — ${note.body}` : note.summary;
    return {
      type: "note",
      key: `${hunkId}:note:${note.id}`,
      hunkId,
      hunkIndex,
      noteId: note.id,
      text,
      ...(note.side === undefined ? {} : { side: note.side }),
      ...(note.line === undefined ? {} : { line: note.line }),
      height: Math.max(1, Math.ceil(stringWidth(text) / Math.max(1, width - 4))),
    };
  });
}

function buildRows(
  metadata: FileDiffMetadata,
  highlighted: Awaited<ReturnType<typeof highlight>>,
  input: CreateDiffPlanInput,
  rowLimit: number,
) {
  const rows: DiffPlanRow[] = [];
  const bounded = () =>
    rows.length >= rowLimit ? ({ rows, truncated: true } as const) : undefined;
  const annotations = input.annotations ?? [];
  const digits = lineDigits(metadata);
  const splitPaneWidth = Math.max(1, Math.floor((input.width - 1) / 2));
  const splitCodeWidth = Math.max(1, splitPaneWidth - digits - 3);
  const stackCodeWidth = Math.max(1, input.width - digits * 2 - 6);

  for (const [hunkIndex, hunk] of metadata.hunks.entries()) {
    const hunkId = diffHunkId(input.documentId, hunk, hunkIndex);
    if (hunk.collapsedBefore > 0) {
      rows.push({
        type: "fold",
        key: `${hunkId}:fold`,
        hunkId,
        hunkIndex,
        height: 1,
        text: `${hunk.collapsedBefore} unchanged ${hunk.collapsedBefore === 1 ? "line" : "lines"}`,
        oldRange: [hunk.deletionStart - hunk.collapsedBefore, hunk.deletionStart - 1],
        newRange: [hunk.additionStart - hunk.collapsedBefore, hunk.additionStart - 1],
      });
      const limit = bounded();
      if (limit) return limit;
    }
    rows.push({
      type: "hunk",
      key: `${hunkId}:header`,
      hunkId,
      hunkIndex,
      height: 1,
      text: formatHunkHeader(hunk),
    });
    rows.push(...noteRows(notesFor(annotations, hunkId), hunkId, hunkIndex, input.width));
    {
      const limit = bounded();
      if (limit) return limit;
    }

    let deletionIndex = hunk.deletionLineIndex;
    let additionIndex = hunk.additionLineIndex;
    let oldLine = hunk.deletionStart;
    let newLine = hunk.additionStart;

    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        for (let offset = 0; offset < content.lines; offset += 1) {
          const oldNumber = oldLine + offset;
          const newNumber = newLine + offset;
          if (input.layout === "split") {
            const left = cell(
              "context",
              metadata.deletionLines[deletionIndex + offset],
              highlighted.deletion[deletionIndex + offset],
              oldNumber,
              undefined,
              splitCodeWidth,
              input,
            );
            const right = cell(
              "context",
              metadata.additionLines[additionIndex + offset],
              highlighted.addition[additionIndex + offset],
              undefined,
              newNumber,
              splitCodeWidth,
              input,
            );
            rows.push({
              type: "split",
              key: `${hunkId}:context:${oldNumber}:${newNumber}`,
              hunkId,
              hunkIndex,
              left,
              right,
              height: Math.max(left.height, right.height),
            });
          } else {
            const lineCell = cell(
              "context",
              metadata.additionLines[additionIndex + offset],
              highlighted.addition[additionIndex + offset],
              oldNumber,
              newNumber,
              stackCodeWidth,
              input,
            );
            rows.push({
              type: "stack",
              key: `${hunkId}:context:${oldNumber}:${newNumber}`,
              hunkId,
              hunkIndex,
              cell: lineCell,
              height: lineCell.height,
            });
          }
          const anchored = annotations.filter(
            (note) =>
              note.hunkId === hunkId &&
              ((note.side === "old" && note.line === oldNumber) ||
                (note.side === "new" && note.line === newNumber)),
          );
          rows.push(...noteRows(anchored, hunkId, hunkIndex, input.width));
          const limit = bounded();
          if (limit) return limit;
        }
        deletionIndex += content.lines;
        additionIndex += content.lines;
        oldLine += content.lines;
        newLine += content.lines;
        continue;
      }

      if (input.layout === "split") {
        const count = Math.max(content.deletions, content.additions);
        for (let offset = 0; offset < count; offset += 1) {
          const oldNumber = offset < content.deletions ? oldLine + offset : undefined;
          const newNumber = offset < content.additions ? newLine + offset : undefined;
          const left = cell(
            oldNumber === undefined ? "empty" : "deletion",
            metadata.deletionLines[deletionIndex + offset],
            highlighted.deletion[deletionIndex + offset],
            oldNumber,
            undefined,
            splitCodeWidth,
            input,
          );
          const right = cell(
            newNumber === undefined ? "empty" : "addition",
            metadata.additionLines[additionIndex + offset],
            highlighted.addition[additionIndex + offset],
            undefined,
            newNumber,
            splitCodeWidth,
            input,
          );
          rows.push({
            type: "split",
            key: `${hunkId}:change:${oldNumber ?? ""}:${newNumber ?? ""}`,
            hunkId,
            hunkIndex,
            left,
            right,
            height: Math.max(left.height, right.height),
          });
          const anchored = annotations.filter(
            (note) =>
              note.hunkId === hunkId &&
              ((note.side === "old" && note.line === oldNumber) ||
                (note.side === "new" && note.line === newNumber)),
          );
          rows.push(...noteRows(anchored, hunkId, hunkIndex, input.width));
          const limit = bounded();
          if (limit) return limit;
        }
      } else {
        for (let offset = 0; offset < content.deletions; offset += 1) {
          const line = oldLine + offset;
          const lineCell = cell(
            "deletion",
            metadata.deletionLines[deletionIndex + offset],
            highlighted.deletion[deletionIndex + offset],
            line,
            undefined,
            stackCodeWidth,
            input,
          );
          rows.push({
            type: "stack",
            key: `${hunkId}:deletion:${line}`,
            hunkId,
            hunkIndex,
            cell: lineCell,
            height: lineCell.height,
          });
          rows.push(
            ...noteRows(notesFor(annotations, hunkId, "old", line), hunkId, hunkIndex, input.width),
          );
          const limit = bounded();
          if (limit) return limit;
        }
        for (let offset = 0; offset < content.additions; offset += 1) {
          const line = newLine + offset;
          const lineCell = cell(
            "addition",
            metadata.additionLines[additionIndex + offset],
            highlighted.addition[additionIndex + offset],
            undefined,
            line,
            stackCodeWidth,
            input,
          );
          rows.push({
            type: "stack",
            key: `${hunkId}:addition:${line}`,
            hunkId,
            hunkIndex,
            cell: lineCell,
            height: lineCell.height,
          });
          rows.push(
            ...noteRows(notesFor(annotations, hunkId, "new", line), hunkId, hunkIndex, input.width),
          );
          const limit = bounded();
          if (limit) return limit;
        }
      }
      deletionIndex += content.deletions;
      additionIndex += content.additions;
      oldLine += content.deletions;
      newLine += content.additions;
    }
  }
  return { rows, truncated: false } as const;
}

/** Build the sole framework-neutral diff plan consumed by terminal renderers and navigation. */
export async function createDiffPlan(input: CreateDiffPlanInput): Promise<DiffRenderPlan> {
  const metadata = metadataFromInput(input);
  const maxRows = Math.max(1, input.maxRows ?? MAX_PLAN_ROWS);
  const sourceLineCount = metadata.additionLines.length + metadata.deletionLines.length;
  const highlighted =
    sourceLineCount > maxRows * 2
      ? { deletion: [], addition: [] }
      : await highlight(metadata, input.theme);
  const numberWidth = lineDigits(metadata);
  const built = buildRows(metadata, highlighted, input, maxRows);
  const truncated = built.truncated;
  const rows = truncated
    ? [
        ...built.rows.slice(0, maxRows - 1),
        {
          type: "truncated" as const,
          key: `${input.documentId}:truncated`,
          height: 1 as const,
          text: "Additional diff rows omitted",
        },
      ]
    : built.rows;
  const rowOffsets: number[] = [];
  let totalHeight = 0;
  for (const row of rows) {
    rowOffsets.push(totalHeight);
    totalHeight += row.height;
  }
  return {
    documentId: input.documentId,
    path: input.path,
    layout: input.layout,
    width: input.width,
    lineNumberWidth: numberWidth,
    rows,
    rowOffsets,
    totalHeight,
    truncated,
    additionCount: metadata.hunks.reduce((total, hunk) => total + hunk.additionLines, 0),
    deletionCount: metadata.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0),
    hunkCount: metadata.hunks.length,
  };
}
