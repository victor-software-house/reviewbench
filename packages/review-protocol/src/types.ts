import type {
  SessionRegistration,
  SessionServerMessage,
  SessionSnapshot,
  SessionTargetInput,
} from "@victor-software-house/reviewbench-session-core";

export type ReviewSide = "old" | "new";
export type ReviewNoteSource = "ai" | "agent" | "user";

export type ReviewSource =
  | {
      kind: "working-tree";
      range?: string | undefined;
      staged: boolean;
      pathspecs?: string[] | undefined;
    }
  | { kind: "commit"; ref?: string | undefined; pathspecs?: string[] | undefined }
  | { kind: "stash"; ref?: string | undefined }
  | { kind: "file-pair"; oldPath: string; newPath: string }
  | { kind: "patch"; file?: string | undefined; text?: string | undefined }
  | {
      kind: "external-diff";
      oldPath: string;
      newPath: string;
      displayPath?: string | undefined;
    };

export interface ReviewHunk {
  id: string;
  index: number;
  header: string;
  oldRange?: readonly [start: number, count: number] | undefined;
  newRange?: readonly [start: number, count: number] | undefined;
}

export interface ReviewDocumentSummary {
  id: string;
  path: string;
  previousPath?: string | undefined;
  additions: number;
  deletions: number;
  hunkCount: number;
}

export interface ReviewDocument extends ReviewDocumentSummary {
  patch?: string | undefined;
  hunks: ReviewHunk[];
}

export interface ReviewDocumentTarget {
  documentId: string;
}

export interface ReviewLineTarget {
  documentId: string;
  hunkId: string;
  side: ReviewSide;
  line: number;
}

export interface ReviewHunkTarget {
  documentId: string;
  hunkId: string;
}

export type ReviewTarget = ReviewDocumentTarget | ReviewHunkTarget | ReviewLineTarget;

export interface ReviewNote {
  id: string;
  source: ReviewNoteSource;
  documentId: string;
  target?: ReviewTarget | undefined;
  summary: string;
  body?: string | undefined;
  markup?: string | undefined;
  author?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
  editable: boolean;
}

export interface ReviewWorkspaceInfo {
  id: string;
  name: string;
  cwd: string;
  repoRoot?: string | undefined;
  source: ReviewSource;
  title: string;
  sourceLabel: string;
  documents: ReviewDocument[];
}

export interface ReviewWorkspaceState {
  id: string;
  selectedDocumentId?: string | undefined;
  selectedHunkId?: string | undefined;
  showAgentNotes: boolean;
  noteMarkupWidth?: number | undefined;
  notes: ReviewNote[];
}

export interface ReviewSessionInfo {
  protocolVersion: number;
  activeWorkspaceId: string;
  workspaces: ReviewWorkspaceInfo[];
}

export interface ReviewSessionState {
  activeWorkspaceId: string;
  workspaces: ReviewWorkspaceState[];
}

export type ReviewSessionRegistration = SessionRegistration<ReviewSessionInfo>;
export type ReviewSessionSnapshot = SessionSnapshot<ReviewSessionState>;

export type ReviewHostCapability =
  | "session:list"
  | "session:get"
  | "review:context"
  | "review:get"
  | "review:navigate"
  | "review:reload"
  | "workspace:add"
  | "workspace:select"
  | "workspace:rename"
  | "workspace:close"
  | "note:add"
  | "note:add-batch"
  | "note:list"
  | "note:remove"
  | "note:clear";

export interface ReviewHostCapabilities {
  protocolVersion: number;
  hostName: string;
  hostVersion: string;
  capabilities: ReviewHostCapability[];
}

export interface AddReviewNoteInput extends SessionTargetInput {
  workspaceId?: string | undefined;
  target: ReviewTarget;
  summary: string;
  body?: string | undefined;
  markup?: string | undefined;
  author?: string | undefined;
  reveal?: boolean | undefined;
}

export interface AddReviewNoteBatchInput extends SessionTargetInput {
  workspaceId?: string | undefined;
  notes: Omit<AddReviewNoteInput, keyof SessionTargetInput | "workspaceId" | "reveal">[];
  revealMode?: "none" | "first" | undefined;
}

export interface NavigateReviewInput extends SessionTargetInput {
  workspaceId?: string | undefined;
  target?: ReviewTarget | undefined;
  noteDirection?: "next" | "previous" | undefined;
}

export interface ReloadReviewInput extends SessionTargetInput {
  workspaceId?: string | undefined;
  source: ReviewSource;
  sourcePath?: string | undefined;
}

export interface AddReviewWorkspaceInput extends SessionTargetInput {
  name: string;
  sourcePath: string;
  source: ReviewSource;
}

export interface TargetReviewWorkspaceInput extends SessionTargetInput {
  workspaceId: string;
}

export interface RenameReviewWorkspaceInput extends TargetReviewWorkspaceInput {
  name: string;
}

export interface RemoveReviewNoteInput extends SessionTargetInput {
  noteId: string;
}

export interface ClearReviewNotesInput extends SessionTargetInput {
  workspaceId?: string | undefined;
  documentId?: string | undefined;
  includeUser?: boolean | undefined;
}

export type ReviewSessionServerMessage =
  | SessionServerMessage<"review.navigate", NavigateReviewInput>
  | SessionServerMessage<"review.reload", ReloadReviewInput>
  | SessionServerMessage<"workspace.add", AddReviewWorkspaceInput>
  | SessionServerMessage<"workspace.select", TargetReviewWorkspaceInput>
  | SessionServerMessage<"workspace.rename", RenameReviewWorkspaceInput>
  | SessionServerMessage<"workspace.close", TargetReviewWorkspaceInput>
  | SessionServerMessage<"note.add", AddReviewNoteInput>
  | SessionServerMessage<"note.add-batch", AddReviewNoteBatchInput>
  | SessionServerMessage<"note.remove", RemoveReviewNoteInput>
  | SessionServerMessage<"note.clear", ClearReviewNotesInput>;

export interface ReviewNavigationResult {
  workspaceId: string;
  documentId: string;
  hunkId: string;
  target?: ReviewLineTarget | undefined;
}

export interface ReviewNoteMutationResult {
  noteIds: string[];
  remainingNoteCount: number;
}

export interface ReviewWorkspaceMutationResult {
  activeWorkspaceId: string;
  workspace: Pick<ReviewWorkspaceInfo, "id" | "name" | "title" | "sourceLabel">;
}

export interface ClosedReviewWorkspaceResult {
  activeWorkspaceId: string;
  closedWorkspaceId: string;
}

export interface ReloadedReviewResult {
  workspaceId: string;
  source: ReviewSource;
  title: string;
  sourceLabel: string;
  documentCount: number;
  selectedDocumentId?: string | undefined;
  selectedHunkId?: string | undefined;
}

export type ReviewSessionCommandResult =
  | ReviewNavigationResult
  | ReviewNoteMutationResult
  | ReviewWorkspaceMutationResult
  | ClosedReviewWorkspaceResult
  | ReloadedReviewResult;

export type ReviewSessionRequest =
  | { action: "session.list" }
  | { action: "session.get"; selector: SessionTargetInput }
  | { action: "review.context"; selector: SessionTargetInput }
  | {
      action: "review.get";
      selector: SessionTargetInput;
      includePatch?: boolean | undefined;
      includeNotes?: boolean | undefined;
    }
  | { action: "review.navigate"; input: NavigateReviewInput }
  | { action: "review.reload"; input: ReloadReviewInput }
  | { action: "workspace.add"; input: AddReviewWorkspaceInput }
  | { action: "workspace.select"; input: TargetReviewWorkspaceInput }
  | { action: "workspace.rename"; input: RenameReviewWorkspaceInput }
  | { action: "workspace.close"; input: TargetReviewWorkspaceInput }
  | { action: "note.add"; input: AddReviewNoteInput }
  | { action: "note.add-batch"; input: AddReviewNoteBatchInput }
  | {
      action: "note.list";
      selector: SessionTargetInput;
      workspaceId?: string | undefined;
      documentId?: string | undefined;
      source?: "all" | "live" | ReviewNoteSource | undefined;
    }
  | { action: "note.remove"; input: RemoveReviewNoteInput }
  | { action: "note.clear"; input: ClearReviewNotesInput };
