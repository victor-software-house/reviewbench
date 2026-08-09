import { z } from "zod";
import type { ReviewSessionRequest, ReviewSource, ReviewTarget } from "./types";

const selectorSchema = z.strictObject({
  sessionId: z.string().optional(),
  sessionPath: z.string().optional(),
  repoRoot: z.string().optional(),
});

const commonOptionsSchema = z
  .strictObject({
    mode: z.enum(["auto", "split", "stack"]),
    cursorLine: z.enum(["row", "number", "off"]),
    vcs: z.string(),
    theme: z.string(),
    agentContext: z.string(),
    pager: z.boolean(),
    watch: z.boolean(),
    experimental: z.boolean(),
    excludeUntracked: z.boolean(),
    lineNumbers: z.boolean(),
    tabWidth: z.int().positive(),
    wrapLines: z.boolean(),
    hunkHeaders: z.boolean(),
    menuBar: z.boolean(),
    agentNotes: z.boolean(),
    copyDecorations: z.boolean(),
    promptSaveViewPreferences: z.boolean(),
    transparentBackground: z.boolean(),
    colorMoved: z.boolean(),
    extensions: z.boolean(),
    extensionPaths: z.array(z.string()),
  })
  .partial();

export const hunkCliInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("vcs"),
    range: z.string().optional(),
    staged: z.boolean(),
    pathspecs: z.array(z.string()).optional(),
    options: commonOptionsSchema,
  }),
  z.strictObject({
    kind: z.literal("show"),
    ref: z.string().optional(),
    pathspecs: z.array(z.string()).optional(),
    options: commonOptionsSchema,
  }),
  z.strictObject({
    kind: z.literal("stash-show"),
    ref: z.string().optional(),
    options: commonOptionsSchema,
  }),
  z.strictObject({
    kind: z.literal("diff"),
    left: z.string(),
    right: z.string(),
    options: commonOptionsSchema,
  }),
  z.strictObject({
    kind: z.literal("patch"),
    file: z.string().optional(),
    text: z.string().optional(),
    options: commonOptionsSchema,
  }),
  z.strictObject({
    kind: z.literal("difftool"),
    left: z.string(),
    right: z.string(),
    path: z.string().optional(),
    options: commonOptionsSchema,
  }),
]);

export type HunkCliInput = z.infer<typeof hunkCliInputSchema>;

const sideSchema = z.enum(["old", "new"]);
const commentSchema = z.strictObject({
  filePath: z.string(),
  hunkIndex: z.int().nonnegative().optional(),
  side: sideSchema.optional(),
  line: z.int().positive().optional(),
  summary: z.string(),
  rationale: z.string().optional(),
  markup: z.string().optional(),
  author: z.string().optional(),
});

export const hunkSessionRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("list") }),
  z.strictObject({ action: z.literal("get"), selector: selectorSchema }),
  z.strictObject({ action: z.literal("context"), selector: selectorSchema }),
  z.strictObject({
    action: z.literal("review"),
    selector: selectorSchema,
    includePatch: z.boolean().optional(),
    includeNotes: z.boolean().optional(),
  }),
  z.strictObject({
    action: z.literal("navigate"),
    selector: selectorSchema,
    filePath: z.string().optional(),
    hunkNumber: z.int().positive().optional(),
    side: sideSchema.optional(),
    line: z.int().positive().optional(),
    commentDirection: z.enum(["next", "prev"]).optional(),
  }),
  z.strictObject({
    action: z.literal("reload"),
    selector: selectorSchema,
    nextInput: hunkCliInputSchema,
    sourcePath: z.string().optional(),
  }),
  z.strictObject({
    action: z.literal("tab-add"),
    selector: selectorSchema,
    name: z.string(),
    sourcePath: z.string(),
    input: hunkCliInputSchema,
  }),
  z.strictObject({ action: z.literal("tab-select"), selector: selectorSchema, tab: z.string() }),
  z.strictObject({ action: z.literal("tab-close"), selector: selectorSchema, tab: z.string() }),
  z.strictObject({
    action: z.literal("tab-rename"),
    selector: selectorSchema,
    tab: z.string(),
    name: z.string(),
  }),
  z.strictObject({
    action: z.literal("comment-add"),
    selector: selectorSchema,
    filePath: z.string(),
    side: sideSchema,
    line: z.int().positive(),
    summary: z.string(),
    rationale: z.string().optional(),
    markup: z.string().optional(),
    author: z.string().optional(),
    reveal: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("comment-apply"),
    selector: selectorSchema,
    comments: z.array(commentSchema),
    revealMode: z.enum(["none", "first"]),
  }),
  z.strictObject({
    action: z.literal("comment-list"),
    selector: selectorSchema,
    filePath: z.string().optional(),
    type: z.enum(["live", "all", "ai", "agent", "user"]).optional(),
  }),
  z.strictObject({
    action: z.literal("comment-rm"),
    selector: selectorSchema,
    commentId: z.string(),
  }),
  z.strictObject({
    action: z.literal("comment-clear"),
    selector: selectorSchema,
    filePath: z.string().optional(),
    includeUser: z.boolean().optional(),
  }),
]);

export type HunkSessionRequest = z.infer<typeof hunkSessionRequestSchema>;

type HunkTargetInput = {
  filePath?: string;
  hunkIndex?: number;
  side?: "old" | "new";
  line?: number;
};

export interface HunkCompatibilityResolver {
  resolveTarget(input: HunkTargetInput): ReviewTarget | undefined;
  resolveWorkspaceId(tab: string): string;
  resolveDocumentId(filePath: string): string;
}

/** Convert Hunk's reloadable CLI input into Reviewbench's product-neutral source identity. */
export function projectHunkReviewSource(input: HunkCliInput): ReviewSource {
  switch (input.kind) {
    case "vcs":
      return {
        kind: "working-tree",
        staged: input.staged,
        ...(input.range === undefined ? {} : { range: input.range }),
        ...(input.pathspecs === undefined ? {} : { pathspecs: input.pathspecs }),
      };
    case "show":
      return {
        kind: "commit",
        ...(input.ref === undefined ? {} : { ref: input.ref }),
        ...(input.pathspecs === undefined ? {} : { pathspecs: input.pathspecs }),
      };
    case "stash-show":
      return { kind: "stash", ...(input.ref === undefined ? {} : { ref: input.ref }) };
    case "diff":
      return { kind: "file-pair", oldPath: input.left, newPath: input.right };
    case "patch":
      return {
        kind: "patch",
        ...(input.file === undefined ? {} : { file: input.file }),
        ...(input.text === undefined ? {} : { text: input.text }),
      };
    case "difftool":
      return {
        kind: "external-diff",
        oldPath: input.left,
        newPath: input.right,
        ...(input.path === undefined ? {} : { displayPath: input.path }),
      };
  }

  input satisfies never;
  throw new Error("Unsupported Hunk review source.");
}

function requireTarget(resolver: HunkCompatibilityResolver, input: HunkTargetInput): ReviewTarget {
  const target = resolver.resolveTarget(input);
  if (!target) {
    throw new Error("The Hunk target does not resolve to a Reviewbench document and hunk.");
  }
  return target;
}

/** Project one validated `hunk session` request onto Reviewbench's host-neutral action surface. */
export function projectHunkSessionRequest(
  request: HunkSessionRequest,
  resolver: HunkCompatibilityResolver,
): ReviewSessionRequest {
  switch (request.action) {
    case "list":
      return { action: "session.list" };
    case "get":
      return { action: "session.get", selector: request.selector };
    case "context":
      return { action: "review.context", selector: request.selector };
    case "review":
      return {
        action: "review.get",
        selector: request.selector,
        ...(request.includePatch === undefined ? {} : { includePatch: request.includePatch }),
        ...(request.includeNotes === undefined ? {} : { includeNotes: request.includeNotes }),
      };
    case "navigate": {
      const target = resolver.resolveTarget({
        ...(request.filePath === undefined ? {} : { filePath: request.filePath }),
        ...(request.hunkNumber === undefined ? {} : { hunkIndex: request.hunkNumber - 1 }),
        ...(request.side === undefined ? {} : { side: request.side }),
        ...(request.line === undefined ? {} : { line: request.line }),
      });
      return {
        action: "review.navigate",
        input: {
          ...request.selector,
          ...(target === undefined ? {} : { target }),
          ...(request.commentDirection === undefined
            ? {}
            : { noteDirection: request.commentDirection === "prev" ? "previous" : "next" }),
        },
      };
    }
    case "reload":
      return {
        action: "review.reload",
        input: {
          ...request.selector,
          source: projectHunkReviewSource(request.nextInput),
          ...(request.sourcePath === undefined ? {} : { sourcePath: request.sourcePath }),
        },
      };
    case "tab-add":
      return {
        action: "workspace.add",
        input: {
          ...request.selector,
          name: request.name,
          sourcePath: request.sourcePath,
          source: projectHunkReviewSource(request.input),
        },
      };
    case "tab-select":
    case "tab-close": {
      const workspaceId = resolver.resolveWorkspaceId(request.tab);
      return {
        action: request.action === "tab-select" ? "workspace.select" : "workspace.close",
        input: { ...request.selector, workspaceId },
      };
    }
    case "tab-rename":
      return {
        action: "workspace.rename",
        input: {
          ...request.selector,
          workspaceId: resolver.resolveWorkspaceId(request.tab),
          name: request.name,
        },
      };
    case "comment-add":
      return {
        action: "note.add",
        input: {
          ...request.selector,
          target: requireTarget(resolver, {
            filePath: request.filePath,
            side: request.side,
            line: request.line,
          }),
          summary: request.summary,
          ...(request.rationale === undefined ? {} : { body: request.rationale }),
          ...(request.markup === undefined ? {} : { markup: request.markup }),
          ...(request.author === undefined ? {} : { author: request.author }),
          reveal: request.reveal,
        },
      };
    case "comment-apply":
      return {
        action: "note.add-batch",
        input: {
          ...request.selector,
          notes: request.comments.map((comment) => ({
            target: requireTarget(resolver, {
              filePath: comment.filePath,
              ...(comment.hunkIndex === undefined ? {} : { hunkIndex: comment.hunkIndex }),
              ...(comment.side === undefined ? {} : { side: comment.side }),
              ...(comment.line === undefined ? {} : { line: comment.line }),
            }),
            summary: comment.summary,
            ...(comment.rationale === undefined ? {} : { body: comment.rationale }),
            ...(comment.markup === undefined ? {} : { markup: comment.markup }),
            ...(comment.author === undefined ? {} : { author: comment.author }),
          })),
          revealMode: request.revealMode,
        },
      };
    case "comment-list":
      return {
        action: "note.list",
        selector: request.selector,
        ...(request.filePath === undefined
          ? {}
          : { documentId: resolver.resolveDocumentId(request.filePath) }),
        ...(request.type === undefined ? {} : { source: request.type }),
      };
    case "comment-rm":
      return { action: "note.remove", input: { ...request.selector, noteId: request.commentId } };
    case "comment-clear":
      return {
        action: "note.clear",
        input: {
          ...request.selector,
          ...(request.filePath === undefined
            ? {}
            : { documentId: resolver.resolveDocumentId(request.filePath) }),
          ...(request.includeUser === undefined ? {} : { includeUser: request.includeUser }),
        },
      };
  }

  request satisfies never;
  throw new Error("Unsupported Hunk session action.");
}

/** Validate one current Hunk session request before projecting it. */
export function parseHunkSessionRequest(value: unknown): HunkSessionRequest {
  const result = hunkSessionRequestSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    const detail = issue ? `${path ? `${path}: ` : ""}${issue.message}` : "invalid request";
    throw new Error(`Invalid Hunk session request: ${detail}`);
  }
  return result.data;
}
