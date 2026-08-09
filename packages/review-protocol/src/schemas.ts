import { z } from "zod";
import type {
  ReviewHostCapabilities,
  ReviewSessionInfo,
  ReviewSessionRegistration,
  ReviewSessionSnapshot,
  ReviewSessionState,
  ReviewSource,
} from "./types";
import { REVIEW_PROTOCOL_VERSION } from "./version";

const nonEmptyString = z.string().min(1);
const positiveLine = z.int().positive();
const rangeSchema = z.tuple([z.int().nonnegative(), z.int().nonnegative()]);
const sideSchema = z.enum(["old", "new"]);

export const reviewSourceSchema: z.ZodType<ReviewSource> = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("working-tree"),
    range: nonEmptyString.optional(),
    staged: z.boolean(),
    pathspecs: z.array(nonEmptyString).optional(),
  }),
  z.strictObject({
    kind: z.literal("commit"),
    ref: nonEmptyString.optional(),
    pathspecs: z.array(nonEmptyString).optional(),
  }),
  z.strictObject({ kind: z.literal("stash"), ref: nonEmptyString.optional() }),
  z.strictObject({
    kind: z.literal("file-pair"),
    oldPath: nonEmptyString,
    newPath: nonEmptyString,
  }),
  z.strictObject({
    kind: z.literal("patch"),
    file: nonEmptyString.optional(),
    text: z.string().optional(),
  }),
  z.strictObject({
    kind: z.literal("external-diff"),
    oldPath: nonEmptyString,
    newPath: nonEmptyString,
    displayPath: nonEmptyString.optional(),
  }),
]);

const reviewHunkSchema = z.strictObject({
  id: nonEmptyString,
  index: z.int().nonnegative(),
  header: z.string(),
  oldRange: rangeSchema.optional(),
  newRange: rangeSchema.optional(),
});

const reviewDocumentSchema = z.strictObject({
  id: nonEmptyString,
  path: nonEmptyString,
  previousPath: nonEmptyString.optional(),
  additions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
  hunkCount: z.int().nonnegative(),
  patch: z.string().optional(),
  hunks: z.array(reviewHunkSchema),
});

const reviewDocumentTargetSchema = z.strictObject({
  documentId: nonEmptyString,
});

const reviewLineTargetSchema = z.strictObject({
  documentId: nonEmptyString,
  hunkId: nonEmptyString,
  side: sideSchema,
  line: positiveLine,
});

const reviewHunkTargetSchema = z.strictObject({
  documentId: nonEmptyString,
  hunkId: nonEmptyString,
});

const reviewTargetSchema = z.union([
  reviewLineTargetSchema,
  reviewHunkTargetSchema,
  reviewDocumentTargetSchema,
]);

const reviewNoteSchema = z.strictObject({
  id: nonEmptyString,
  source: z.enum(["ai", "agent", "user"]),
  documentId: nonEmptyString,
  target: reviewTargetSchema.optional(),
  summary: z.string(),
  body: z.string().optional(),
  markup: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
  editable: z.boolean(),
});

const reviewWorkspaceInfoSchema = z.strictObject({
  id: nonEmptyString,
  name: nonEmptyString,
  cwd: nonEmptyString,
  repoRoot: nonEmptyString.optional(),
  source: reviewSourceSchema,
  title: z.string(),
  sourceLabel: z.string(),
  documents: z.array(reviewDocumentSchema),
});

const reviewWorkspaceStateSchema = z.strictObject({
  id: nonEmptyString,
  selectedDocumentId: nonEmptyString.optional(),
  selectedHunkId: nonEmptyString.optional(),
  showAgentNotes: z.boolean(),
  noteMarkupWidth: z.int().positive().optional(),
  notes: z.array(reviewNoteSchema),
});

export const reviewSessionInfoSchema: z.ZodType<ReviewSessionInfo> = z
  .strictObject({
    protocolVersion: z.literal(REVIEW_PROTOCOL_VERSION),
    activeWorkspaceId: nonEmptyString,
    workspaces: z.array(reviewWorkspaceInfoSchema).min(1),
  })
  .superRefine((info, context) => {
    const workspaceIds = new Set<string>();
    for (const [workspaceIndex, workspace] of info.workspaces.entries()) {
      if (workspaceIds.has(workspace.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate workspace id ${workspace.id}.`,
          path: ["workspaces", workspaceIndex, "id"],
        });
      }
      workspaceIds.add(workspace.id);

      const documentIds = new Set<string>();
      for (const [documentIndex, document] of workspace.documents.entries()) {
        if (documentIds.has(document.id)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate document id ${document.id}.`,
            path: ["workspaces", workspaceIndex, "documents", documentIndex, "id"],
          });
        }
        documentIds.add(document.id);

        if (document.hunkCount !== document.hunks.length) {
          context.addIssue({
            code: "custom",
            message: "hunkCount must equal the number of hunks.",
            path: ["workspaces", workspaceIndex, "documents", documentIndex, "hunkCount"],
          });
        }

        const hunkIds = new Set<string>();
        for (const [hunkIndex, hunk] of document.hunks.entries()) {
          if (hunkIds.has(hunk.id)) {
            context.addIssue({
              code: "custom",
              message: `Duplicate hunk id ${hunk.id}.`,
              path: [
                "workspaces",
                workspaceIndex,
                "documents",
                documentIndex,
                "hunks",
                hunkIndex,
                "id",
              ],
            });
          }
          hunkIds.add(hunk.id);
        }
      }
    }

    if (!workspaceIds.has(info.activeWorkspaceId)) {
      context.addIssue({
        code: "custom",
        message: "activeWorkspaceId must identify one registered workspace.",
        path: ["activeWorkspaceId"],
      });
    }
  });

export const reviewSessionStateSchema: z.ZodType<ReviewSessionState> = z
  .strictObject({
    activeWorkspaceId: nonEmptyString,
    workspaces: z.array(reviewWorkspaceStateSchema).min(1),
  })
  .superRefine((state, context) => {
    const workspaceIds = new Set<string>();
    for (const [workspaceIndex, workspace] of state.workspaces.entries()) {
      if (workspaceIds.has(workspace.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate workspace state id ${workspace.id}.`,
          path: ["workspaces", workspaceIndex, "id"],
        });
      }
      workspaceIds.add(workspace.id);

      for (const [noteIndex, note] of workspace.notes.entries()) {
        if (note.target && note.target.documentId !== note.documentId) {
          context.addIssue({
            code: "custom",
            message: "A note target must belong to the note document.",
            path: ["workspaces", workspaceIndex, "notes", noteIndex, "target", "documentId"],
          });
        }
      }
    }

    if (!workspaceIds.has(state.activeWorkspaceId)) {
      context.addIssue({
        code: "custom",
        message: "activeWorkspaceId must identify one workspace state.",
        path: ["activeWorkspaceId"],
      });
    }
  });

const reviewHostCapabilitySchema = z.enum([
  "session:list",
  "session:get",
  "review:context",
  "review:get",
  "review:navigate",
  "review:reload",
  "workspace:add",
  "workspace:select",
  "workspace:rename",
  "workspace:close",
  "note:add",
  "note:add-batch",
  "note:list",
  "note:remove",
  "note:clear",
]);

export const reviewHostCapabilitiesSchema: z.ZodType<ReviewHostCapabilities> = z.strictObject({
  protocolVersion: z.literal(REVIEW_PROTOCOL_VERSION),
  hostName: nonEmptyString,
  hostVersion: nonEmptyString,
  capabilities: z.array(reviewHostCapabilitySchema),
});

/** Parse one host capability declaration at the versioned protocol boundary. */
export function parseReviewHostCapabilities(value: unknown): ReviewHostCapabilities | null {
  const result = reviewHostCapabilitiesSchema.safeParse(value);
  return result.success ? result.data : null;
}

const terminalLocationSchema = z.strictObject({
  source: nonEmptyString,
  tty: z.string().optional(),
  windowId: z.string().optional(),
  tabId: z.string().optional(),
  paneId: z.string().optional(),
  terminalId: z.string().optional(),
  sessionId: z.string().optional(),
});

const terminalMetadataSchema = z.strictObject({
  program: z.string().optional(),
  locations: z.array(terminalLocationSchema),
});

const registrationSchema = z.strictObject({
  registrationVersion: z.int().positive(),
  sessionId: nonEmptyString,
  pid: z.int().positive(),
  cwd: nonEmptyString,
  repoRoot: nonEmptyString.optional(),
  launchedAt: z.iso.datetime(),
  terminal: terminalMetadataSchema.optional(),
  info: reviewSessionInfoSchema,
});

const snapshotSchema = z.strictObject({
  updatedAt: z.iso.datetime(),
  state: reviewSessionStateSchema,
});

/** Parse one host registration, rejecting a different review protocol version. */
export function parseReviewSessionRegistration(value: unknown): ReviewSessionRegistration | null {
  const result = registrationSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Parse one live host snapshot at the review protocol boundary. */
export function parseReviewSessionSnapshot(value: unknown): ReviewSessionSnapshot | null {
  const result = snapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
