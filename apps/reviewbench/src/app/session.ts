import {
  type HunkCompatibilityResolver,
  type HunkSessionRequest,
  parseHunkSessionRequest,
  parseReviewSessionRegistration,
  parseReviewSessionSnapshot,
  projectHunkSessionRequest,
  REVIEW_PROTOCOL_VERSION,
  type ReviewDocument,
  type ReviewSessionCommandResult,
  type ReviewSessionInfo,
  type ReviewSessionRegistration,
  type ReviewSessionServerMessage,
  type ReviewSessionSnapshot,
  type ReviewSessionState,
  type ReviewWorkspaceInfo,
  type ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import {
  createSessionBrokerDaemon,
  MAX_HTTP_BODY_BYTES,
  parseSessionRegistrationEnvelope,
  parseSessionSnapshotEnvelope,
  readRequestTextWithLimit,
  SESSION_BROKER_REGISTRATION_VERSION,
  SessionBroker,
  SessionBrokerConnection,
  type SessionBrokerRecord,
  type SessionBrokerSocketLike,
  serveSessionBrokerDaemon,
} from "@victor-software-house/reviewbench-session-daemon";
import type { ReviewbenchHost } from "./host";

export const HUNK_SESSION_API_PATH = "/session-api";
export const HUNK_SESSION_CAPABILITIES_PATH = `${HUNK_SESSION_API_PATH}/capabilities`;
const HUNK_SESSION_ACTIONS = [
  "list",
  "get",
  "context",
  "review",
  "navigate",
  "comment-add",
  "comment-list",
  "comment-rm",
] as const;

function isLoopback(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}

function rejectsLocalAuthority(request: Request, port: number) {
  const authority = request.headers.get("host");
  if (!authority) return Response.json({ error: "Expected Host header." }, { status: 400 });
  let host: URL;
  try {
    host = new URL(`http://${authority}`);
  } catch {
    return Response.json({ error: "Host header is not allowed." }, { status: 403 });
  }
  if (!isLoopback(host.hostname) || Number.parseInt(host.port || "80", 10) !== port) {
    return Response.json({ error: "Host header is not allowed." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    if (!isLoopback(parsed.hostname) || Number.parseInt(parsed.port || "80", 10) !== port) {
      return Response.json({ error: "Origin is not allowed." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "Origin is not allowed." }, { status: 403 });
  }
  return null;
}

type ReviewbenchRecord = SessionBrokerRecord<ReviewSessionInfo, ReviewSessionState>;

function activeWorkspace(record: ReviewbenchRecord) {
  const info = record.registration.info.workspaces.find(
    (workspace) => workspace.id === record.snapshot.state.activeWorkspaceId,
  );
  const state = record.snapshot.state.workspaces.find(
    (workspace) => workspace.id === record.snapshot.state.activeWorkspaceId,
  );
  if (!info || !state) throw new Error("Active review workspace is missing from the session.");
  return { info, state };
}

function selectedDocument(info: ReviewWorkspaceInfo, state: ReviewWorkspaceState) {
  return info.documents.find((document) => document.id === state.selectedDocumentId) ?? null;
}

function hunkIndex(document: ReviewDocument | null, hunkId?: string) {
  if (!document || !hunkId) return 0;
  const index = document.hunks.findIndex((hunk) => hunk.id === hunkId);
  return index < 0 ? 0 : index;
}

function hunkInput(source: ReviewWorkspaceInfo["source"]): Record<string, unknown> {
  switch (source.kind) {
    case "working-tree":
      return {
        kind: "vcs",
        staged: source.staged,
        options: {},
        ...(source.range === undefined ? {} : { range: source.range }),
        ...(source.pathspecs === undefined ? {} : { pathspecs: source.pathspecs }),
      };
    case "commit":
      return {
        kind: "show",
        options: {},
        ...(source.ref === undefined ? {} : { ref: source.ref }),
        ...(source.pathspecs === undefined ? {} : { pathspecs: source.pathspecs }),
      };
    case "stash":
      return {
        kind: "stash-show",
        options: {},
        ...(source.ref === undefined ? {} : { ref: source.ref }),
      };
    case "file-pair":
      return { kind: "diff", left: source.oldPath, right: source.newPath, options: {} };
    case "patch":
      return {
        kind: "patch",
        options: {},
        ...(source.file === undefined ? {} : { file: source.file }),
        ...(source.text === undefined ? {} : { text: source.text }),
      };
    case "external-diff":
      return {
        kind: "difftool",
        left: source.oldPath,
        right: source.newPath,
        options: {},
        ...(source.displayPath === undefined ? {} : { path: source.displayPath }),
      };
  }
  source satisfies never;
  throw new Error("Unsupported Reviewbench source.");
}

function hunkReviewFile(document: ReviewDocument, includePatch: boolean) {
  return {
    id: document.id,
    path: document.path,
    ...(document.previousPath === undefined ? {} : { previousPath: document.previousPath }),
    additions: document.additions,
    deletions: document.deletions,
    hunkCount: document.hunkCount,
    ...(includePatch && document.patch !== undefined ? { patch: document.patch } : {}),
    hunks: document.hunks.map((hunk) => ({
      index: hunk.index,
      header: hunk.header,
      ...(hunk.oldRange === undefined ? {} : { oldRange: [...hunk.oldRange] }),
      ...(hunk.newRange === undefined ? {} : { newRange: [...hunk.newRange] }),
    })),
  };
}

function hunkNotes(workspace: ReviewWorkspaceInfo, state: ReviewWorkspaceState) {
  const paths = new Map(workspace.documents.map((document) => [document.id, document.path]));
  return state.notes.map((note) => {
    const target = note.target;
    const targetDocument = workspace.documents.find((document) => document.id === note.documentId);
    return {
      noteId: note.id,
      source: note.source,
      filePath: paths.get(note.documentId) ?? note.documentId,
      ...(!target || !("hunkId" in target)
        ? {}
        : {
            hunkIndex: targetDocument?.hunks.findIndex((hunk) => hunk.id === target.hunkId) ?? 0,
          }),
      ...(!target || !("side" in target) ? {} : { side: target.side, line: target.line }),
      body: note.body ?? note.markup ?? note.summary,
      title: note.summary,
      ...(note.author === undefined ? {} : { author: note.author }),
      createdAt: note.createdAt,
      ...(note.updatedAt === undefined ? {} : { updatedAt: note.updatedAt }),
      editable: note.editable,
    };
  });
}

function hunkListedSession(record: ReviewbenchRecord) {
  const workspaces = new Map(record.snapshot.state.workspaces.map((state) => [state.id, state]));
  return {
    sessionId: record.sessionId,
    pid: record.registration.pid,
    cwd: record.cwd,
    launchedAt: record.registration.launchedAt,
    ...(record.registration.terminal === undefined
      ? {}
      : { terminal: record.registration.terminal }),
    activeTabId: record.snapshot.state.activeWorkspaceId,
    tabs: record.registration.info.workspaces.map((workspace) => {
      const state = workspaces.get(workspace.id);
      if (!state) throw new Error(`Review workspace state is missing: ${workspace.id}`);
      const document = selectedDocument(workspace, state);
      const notes = hunkNotes(workspace, state);
      return {
        tabId: workspace.id,
        name: workspace.name,
        cwd: workspace.cwd,
        ...(workspace.repoRoot === undefined ? {} : { repoRoot: workspace.repoRoot }),
        input: hunkInput(workspace.source),
        inputKind: hunkInput(workspace.source).kind,
        title: workspace.title,
        sourceLabel: workspace.sourceLabel,
        files: workspace.documents.map((file) => ({
          id: file.id,
          path: file.path,
          ...(file.previousPath === undefined ? {} : { previousPath: file.previousPath }),
          additions: file.additions,
          deletions: file.deletions,
          hunkCount: file.hunkCount,
        })),
        state: {
          tabId: workspace.id,
          ...(document === null
            ? {}
            : { selectedFileId: document.id, selectedFilePath: document.path }),
          selectedHunkIndex: hunkIndex(document, state.selectedHunkId),
          showAgentNotes: state.showAgentNotes,
          ...(state.noteMarkupWidth === undefined
            ? {}
            : { noteMarkupWidth: state.noteMarkupWidth }),
          liveCommentCount: state.notes.filter((note) => note.source === "agent").length,
          liveComments: [],
          reviewNoteCount: notes.length,
          reviewNotes: notes,
        },
      };
    }),
    snapshot: { updatedAt: record.snapshot.updatedAt },
  };
}

function hunkContext(record: ReviewbenchRecord) {
  const { info, state } = activeWorkspace(record);
  const document = selectedDocument(info, state);
  const index = hunkIndex(document, state.selectedHunkId);
  const hunk = document?.hunks[index];
  return {
    sessionId: record.sessionId,
    activeTabId: info.id,
    tab: {
      tabId: info.id,
      name: info.name,
      cwd: info.cwd,
      ...(info.repoRoot === undefined ? {} : { repoRoot: info.repoRoot }),
      inputKind: hunkInput(info.source).kind,
      title: info.title,
      sourceLabel: info.sourceLabel,
      selectedFile: document
        ? {
            id: document.id,
            path: document.path,
            additions: document.additions,
            deletions: document.deletions,
            hunkCount: document.hunkCount,
          }
        : null,
      selectedHunk: hunk
        ? {
            index: hunk.index,
            ...(hunk.oldRange === undefined ? {} : { oldRange: [...hunk.oldRange] }),
            ...(hunk.newRange === undefined ? {} : { newRange: [...hunk.newRange] }),
          }
        : null,
      showAgentNotes: state.showAgentNotes,
      ...(state.noteMarkupWidth === undefined ? {} : { noteMarkupWidth: state.noteMarkupWidth }),
      liveCommentCount: state.notes.filter((note) => note.source === "agent").length,
    },
  };
}

function hunkReview(record: ReviewbenchRecord, includePatch: boolean, includeNotes: boolean) {
  const { info, state } = activeWorkspace(record);
  const document = selectedDocument(info, state);
  const index = hunkIndex(document, state.selectedHunkId);
  const notes = hunkNotes(info, state);
  return {
    sessionId: record.sessionId,
    activeTabId: info.id,
    tab: {
      tabId: info.id,
      name: info.name,
      cwd: info.cwd,
      ...(info.repoRoot === undefined ? {} : { repoRoot: info.repoRoot }),
      inputKind: hunkInput(info.source).kind,
      title: info.title,
      sourceLabel: info.sourceLabel,
      selectedFile: document ? hunkReviewFile(document, includePatch) : null,
      selectedHunk: document?.hunks[index]
        ? hunkReviewFile(document, includePatch).hunks[index]
        : null,
      showAgentNotes: state.showAgentNotes,
      liveCommentCount: state.notes.filter((note) => note.source === "agent").length,
      reviewNoteCount: notes.length,
      ...(includeNotes ? { reviewNotes: notes } : {}),
      files: info.documents.map((file) => hunkReviewFile(file, includePatch)),
    },
  };
}

function resolverFor(record: ReviewbenchRecord): HunkCompatibilityResolver {
  const { info } = activeWorkspace(record);
  return {
    resolveWorkspaceId: (tab) =>
      record.registration.info.workspaces.find(
        (workspace) => workspace.id === tab || workspace.name === tab,
      )?.id ?? tab,
    resolveDocumentId: (filePath) =>
      info.documents.find(
        (document) =>
          document.id === filePath ||
          document.path === filePath ||
          document.previousPath === filePath,
      )?.id ?? filePath,
    resolveTarget: ({ filePath, hunkIndex: requestedIndex, side, line }) => {
      const document = info.documents.find(
        (candidate) =>
          candidate.id === filePath ||
          candidate.path === filePath ||
          candidate.previousPath === filePath,
      );
      if (!document) return undefined;
      if (requestedIndex === undefined && (side === undefined || line === undefined)) {
        return { documentId: document.id };
      }
      const hunk =
        requestedIndex === undefined
          ? document.hunks.find((candidate) => {
              const range = side === "old" ? candidate.oldRange : candidate.newRange;
              return range && line !== undefined && line >= range[0] && line < range[0] + range[1];
            })
          : document.hunks[requestedIndex];
      if (!hunk) return undefined;
      return side === undefined || line === undefined
        ? { documentId: document.id, hunkId: hunk.id }
        : { documentId: document.id, hunkId: hunk.id, side, line };
    },
  };
}

async function hunkRequest(
  broker: SessionBroker<
    ReviewSessionInfo,
    ReviewSessionState,
    ReviewSessionServerMessage,
    ReviewSessionCommandResult
  >,
  request: HunkSessionRequest,
) {
  if (request.action === "list") return { sessions: broker.listSessions().map(hunkListedSession) };
  const record = broker.getSession(request.selector);
  if (request.action === "get") return { session: hunkListedSession(record) };
  if (request.action === "context") return { context: hunkContext(record) };
  if (request.action === "review") {
    return {
      review: hunkReview(record, request.includePatch ?? false, request.includeNotes ?? false),
    };
  }
  if (request.action === "comment-list") {
    const { info, state } = activeWorkspace(record);
    const notes = hunkNotes(info, state).filter((note) => {
      if (request.filePath && note.filePath !== request.filePath) return false;
      if (
        request.type &&
        request.type !== "all" &&
        request.type !== "live" &&
        note.source !== request.type
      )
        return false;
      return true;
    });
    return { comments: notes };
  }

  const projected = projectHunkSessionRequest(request, resolverFor(record));
  if (request.action === "navigate") {
    if (projected.action !== "review.navigate") throw new Error("Invalid navigation projection.");
    const result = await broker.dispatchCommand({
      selector: request.selector,
      command: projected.action,
      input: projected.input,
      timeoutMessage: "Timed out waiting for Reviewbench to navigate.",
    });
    void result;
    const target = projected.input.target;
    const document = activeWorkspace(record).info.documents.find(
      (item) => item.id === target?.documentId,
    );
    const index =
      document?.hunks.findIndex(
        (hunk) => hunk.id === (target && "hunkId" in target ? target.hunkId : ""),
      ) ?? 0;
    return {
      result: {
        fileId: document?.id ?? target?.documentId,
        filePath: document?.path ?? target?.documentId,
        hunkIndex: Math.max(0, index),
      },
    };
  }
  if (request.action === "comment-add") {
    if (projected.action !== "note.add") throw new Error("Invalid note projection.");
    const result = await broker.dispatchCommand({
      selector: request.selector,
      command: projected.action,
      input: projected.input,
      timeoutMessage: "Timed out waiting for Reviewbench to add the note.",
    });
    const noteId = "noteIds" in result ? result.noteIds[0] : undefined;
    if (!noteId) throw new Error("Reviewbench did not return the created note id.");
    const document = activeWorkspace(record).info.documents.find(
      (item) => item.path === request.filePath,
    );
    const index =
      document?.hunks.findIndex(
        (hunk) =>
          hunk.id === ("hunkId" in projected.input.target ? projected.input.target.hunkId : ""),
      ) ?? 0;
    return {
      result: {
        commentId: noteId,
        fileId: document?.id ?? request.filePath,
        filePath: request.filePath,
        hunkIndex: Math.max(0, index),
        side: request.side,
        line: request.line,
      },
    };
  }
  if (request.action === "comment-rm") {
    if (projected.action !== "note.remove") throw new Error("Invalid removal projection.");
    const result = await broker.dispatchCommand({
      selector: request.selector,
      command: projected.action,
      input: projected.input,
      timeoutMessage: "Timed out waiting for Reviewbench to remove the note.",
    });
    return {
      result: {
        commentId: request.commentId,
        removed: "noteIds" in result && result.noteIds.length > 0,
        remainingCommentCount: "remainingNoteCount" in result ? result.remainingNoteCount : 0,
        source: "agent",
      },
    };
  }
  throw new Error(`Reviewbench does not support Hunk action ${request.action} in this spike.`);
}

export interface ReviewbenchSessionRuntime {
  origin: string;
  sessionId: string;
  updateSnapshot(state: ReviewSessionState): void;
  stop(): void;
}

class BunSessionSocket implements SessionBrokerSocketLike {
  readonly socket: WebSocket;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", () => this.onopen?.());
    this.socket.addEventListener("message", (event) => this.onmessage?.({ data: event.data }));
    this.socket.addEventListener("close", (event) =>
      this.onclose?.({ code: event.code, reason: event.reason }),
    );
    this.socket.addEventListener("error", () => this.onerror?.());
  }

  get readyState() {
    return this.socket.readyState;
  }

  send(data: string) {
    this.socket.send(data);
  }

  close() {
    this.socket.close();
  }
}

/** Start one loopback Bun daemon and register the live Reviewbench host with Hunk-compatible HTTP. */
export function startReviewbenchSessionRuntime(options: {
  host: ReviewbenchHost;
  workspace: ReviewWorkspaceInfo;
  state: ReviewWorkspaceState;
  hostname?: string;
  port?: number;
}): ReviewbenchSessionRuntime {
  const hostname = options.hostname ?? "127.0.0.1";
  if (!isLoopback(hostname)) {
    throw new Error(`Reviewbench session daemon requires a loopback host, received ${hostname}.`);
  }
  const sessionId = crypto.randomUUID();
  const registration: ReviewSessionRegistration = {
    registrationVersion: SESSION_BROKER_REGISTRATION_VERSION,
    sessionId,
    pid: process.pid,
    cwd: options.workspace.cwd,
    ...(options.workspace.repoRoot === undefined ? {} : { repoRoot: options.workspace.repoRoot }),
    launchedAt: new Date().toISOString(),
    info: {
      protocolVersion: REVIEW_PROTOCOL_VERSION,
      activeWorkspaceId: options.workspace.id,
      workspaces: [options.workspace],
    },
  };
  const snapshot = (): ReviewSessionSnapshot => ({
    updatedAt: new Date().toISOString(),
    state: options.host.snapshot(),
  });
  const broker = new SessionBroker<
    ReviewSessionInfo,
    ReviewSessionState,
    ReviewSessionServerMessage,
    ReviewSessionCommandResult
  >({
    parseRegistration: (value) =>
      parseSessionRegistrationEnvelope(value, (info) => {
        const parsed = parseReviewSessionRegistration({ ...registration, info });
        return parsed?.info ?? null;
      }),
    parseSnapshot: (value) =>
      parseSessionSnapshotEnvelope(value, (state) => {
        const parsed = parseReviewSessionSnapshot({ updatedAt: new Date().toISOString(), state });
        return parsed?.state ?? null;
      }),
    describeSession: (sessionRegistration) =>
      sessionRegistration.info.workspaces[0]?.title ?? sessionId,
  });
  const daemon = createSessionBrokerDaemon({
    broker,
    capabilities: { version: REVIEW_PROTOCOL_VERSION, name: "reviewbench-session-broker" },
    paths: { socket: "/session" },
    idleTimeoutMs: 0,
  });
  const server = serveSessionBrokerDaemon({
    daemon,
    hostname,
    port: options.port ?? 0,
    handleRequest: async (request) => {
      const url = new URL(request.url);
      const authorityError = rejectsLocalAuthority(request, Number.parseInt(url.port, 10));
      if (authorityError) return authorityError;
      if (url.pathname === HUNK_SESSION_CAPABILITIES_PATH) {
        return Response.json({
          version: 1,
          daemonVersion: 7,
          actions: HUNK_SESSION_ACTIONS,
        });
      }
      if (url.pathname !== HUNK_SESSION_API_PATH) return undefined;
      if (request.method !== "POST") {
        return Response.json({ error: "Expected POST." }, { status: 405 });
      }
      if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
        return Response.json({ error: "Expected Content-Type application/json." }, { status: 415 });
      }
      try {
        const text = await readRequestTextWithLimit(request, MAX_HTTP_BODY_BYTES);
        const input = parseHunkSessionRequest(JSON.parse(text));
        return Response.json(await hunkRequest(broker, input));
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown session error." },
          { status: 400 },
        );
      }
    },
  });
  const origin = `http://${hostname}:${server.port}`;
  let connection: SessionBrokerConnection<
    ReviewSessionInfo,
    ReviewSessionState,
    SessionBrokerSocketLike,
    ReviewSessionServerMessage,
    ReviewSessionCommandResult
  >;
  const bridge = {
    dispatchCommand: async (message: ReviewSessionServerMessage) => {
      const result = await options.host.dispatchCommand(message);
      connection.updateSnapshot(snapshot());
      return result;
    },
  };
  connection = new SessionBrokerConnection({
    url: `ws://${hostname}:${server.port}/session`,
    createSocket: (url) => new BunSessionSocket(url),
    registration,
    snapshot: snapshot(),
    bridge,
    reconnectDelayMs: 25,
  });
  connection.start();

  return {
    origin,
    sessionId,
    updateSnapshot: (state) =>
      connection.updateSnapshot({ updatedAt: new Date().toISOString(), state }),
    stop: () => {
      connection.stop();
      void server.stop(true);
    },
  };
}
