import { describe, expect, test } from "bun:test";
import {
  type HunkCompatibilityResolver,
  parseHunkSessionRequest,
  parseReviewHostCapabilities,
  parseReviewSessionRegistration,
  parseReviewSessionSnapshot,
  projectHunkReviewSource,
  projectHunkSessionRequest,
  REVIEW_PROTOCOL_VERSION,
  type ReviewSessionRegistration,
  type ReviewSessionRequest,
  type ReviewSessionSnapshot,
} from "./index";

const resolver: HunkCompatibilityResolver = {
  resolveTarget: ({ filePath, hunkIndex, side, line }) => {
    if (!filePath) return undefined;
    const documentId = `document:${filePath}`;
    if (hunkIndex === undefined && (side === undefined || line === undefined)) {
      return { documentId };
    }
    const hunkId = `hunk:${hunkIndex ?? 0}`;
    return side === undefined || line === undefined
      ? { documentId, hunkId }
      : { documentId, hunkId, side, line };
  },
  resolveWorkspaceId: (tab) => `workspace:${tab}`,
  resolveDocumentId: (filePath) => `document:${filePath}`,
};

const registration = {
  registrationVersion: 2,
  sessionId: "session-1",
  pid: 42,
  cwd: "/repo",
  launchedAt: "2026-08-09T12:00:00.000Z",
  info: {
    protocolVersion: REVIEW_PROTOCOL_VERSION,
    activeWorkspaceId: "workspace-1",
    workspaces: [
      {
        id: "workspace-1",
        name: "main",
        cwd: "/repo",
        repoRoot: "/repo",
        source: { kind: "working-tree", staged: false },
        title: "Working tree",
        sourceLabel: "git diff",
        documents: [
          {
            id: "document:src/a.ts",
            path: "src/a.ts",
            additions: 1,
            deletions: 0,
            hunkCount: 1,
            hunks: [
              {
                id: "hunk:0",
                index: 0,
                header: "@@ -1 +1 @@",
                oldRange: [1, 1],
                newRange: [1, 1],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies ReviewSessionRegistration;

const snapshot = {
  updatedAt: "2026-08-09T12:00:01.000Z",
  state: {
    activeWorkspaceId: "workspace-1",
    workspaces: [
      {
        id: "workspace-1",
        selectedDocumentId: "document:src/a.ts",
        selectedHunkId: "hunk:0",
        showAgentNotes: true,
        notes: [
          {
            id: "note-1",
            source: "agent",
            documentId: "document:src/a.ts",
            target: {
              documentId: "document:src/a.ts",
              hunkId: "hunk:0",
              side: "new",
              line: 1,
            },
            summary: "Check this boundary",
            createdAt: "2026-08-09T12:00:01.000Z",
            editable: true,
          },
        ],
      },
    ],
  },
} satisfies ReviewSessionSnapshot;

describe("review session wire validation", () => {
  test("accepts strict product-neutral registration and snapshot envelopes", () => {
    expect(parseReviewSessionRegistration(registration)).toEqual(registration);
    expect(parseReviewSessionSnapshot(snapshot)).toEqual(snapshot);
  });

  test("negotiates explicit capabilities at the same protocol version", () => {
    expect(
      parseReviewHostCapabilities({
        protocolVersion: REVIEW_PROTOCOL_VERSION,
        hostName: "reviewbench",
        hostVersion: "0.0.0",
        capabilities: ["session:list", "review:navigate", "note:add"],
      }),
    ).toEqual({
      protocolVersion: REVIEW_PROTOCOL_VERSION,
      hostName: "reviewbench",
      hostVersion: "0.0.0",
      capabilities: ["session:list", "review:navigate", "note:add"],
    });
    expect(
      parseReviewHostCapabilities({
        protocolVersion: REVIEW_PROTOCOL_VERSION,
        hostName: "partial-host",
        hostVersion: "1",
        capabilities: ["unknown:action"],
      }),
    ).toBeNull();
  });

  test("rejects version drift, unknown fields, and inexact line targets", () => {
    expect(
      parseReviewSessionRegistration({
        ...registration,
        info: { ...registration.info, protocolVersion: 2 },
      }),
    ).toBeNull();
    expect(parseReviewSessionSnapshot({ ...snapshot, extra: true })).toBeNull();
    expect(
      parseReviewSessionSnapshot({
        ...snapshot,
        state: {
          ...snapshot.state,
          workspaces: [
            {
              ...snapshot.state.workspaces[0],
              notes: [
                {
                  ...snapshot.state.workspaces[0]?.notes[0],
                  target: { documentId: "document:src/a.ts", side: "new", line: 1 },
                },
              ],
            },
          ],
        },
      }),
    ).toBeNull();
  });

  test("rejects incoherent workspace, document, hunk, and note identities", () => {
    expect(
      parseReviewSessionRegistration({
        ...registration,
        info: { ...registration.info, activeWorkspaceId: "missing" },
      }),
    ).toBeNull();
    expect(
      parseReviewSessionRegistration({
        ...registration,
        info: {
          ...registration.info,
          workspaces: [
            {
              ...registration.info.workspaces[0],
              documents: [
                {
                  ...registration.info.workspaces[0]?.documents[0],
                  hunkCount: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toBeNull();
    expect(
      parseReviewSessionSnapshot({
        ...snapshot,
        state: {
          ...snapshot.state,
          workspaces: [
            {
              ...snapshot.state.workspaces[0],
              notes: [
                {
                  ...snapshot.state.workspaces[0]?.notes[0],
                  target: { documentId: "other", hunkId: "hunk:0" },
                },
              ],
            },
          ],
        },
      }),
    ).toBeNull();
  });
});

describe("Hunk compatibility projection", () => {
  test("projects every current Hunk session action", () => {
    const cases: Array<[unknown, ReviewSessionRequest["action"]]> = [
      [{ action: "list" }, "session.list"],
      [{ action: "get", selector: { sessionId: "s-1" } }, "session.get"],
      [{ action: "context", selector: { sessionId: "s-1" } }, "review.context"],
      [{ action: "review", selector: { sessionId: "s-1" } }, "review.get"],
      [
        {
          action: "navigate",
          selector: { sessionId: "s-1" },
          filePath: "src/a.ts",
          hunkNumber: 1,
        },
        "review.navigate",
      ],
      [
        {
          action: "reload",
          selector: { sessionId: "s-1" },
          nextInput: { kind: "show", ref: "HEAD", options: {} },
        },
        "review.reload",
      ],
      [
        {
          action: "tab-add",
          selector: { sessionId: "s-1" },
          name: "api",
          sourcePath: "/repo",
          input: { kind: "vcs", staged: false, options: {} },
        },
        "workspace.add",
      ],
      [{ action: "tab-select", selector: { sessionId: "s-1" }, tab: "api" }, "workspace.select"],
      [
        { action: "tab-rename", selector: { sessionId: "s-1" }, tab: "api", name: "API" },
        "workspace.rename",
      ],
      [{ action: "tab-close", selector: { sessionId: "s-1" }, tab: "api" }, "workspace.close"],
      [
        {
          action: "comment-add",
          selector: { sessionId: "s-1" },
          filePath: "src/a.ts",
          side: "new",
          line: 1,
          summary: "note",
          reveal: false,
        },
        "note.add",
      ],
      [
        {
          action: "comment-apply",
          selector: { sessionId: "s-1" },
          comments: [{ filePath: "src/a.ts", summary: "note" }],
          revealMode: "none",
        },
        "note.add-batch",
      ],
      [
        { action: "comment-list", selector: { sessionId: "s-1" }, filePath: "src/a.ts" },
        "note.list",
      ],
      [
        { action: "comment-rm", selector: { sessionId: "s-1" }, commentId: "note-1" },
        "note.remove",
      ],
      [
        { action: "comment-clear", selector: { sessionId: "s-1" }, filePath: "src/a.ts" },
        "note.clear",
      ],
    ];

    for (const [input, expectedAction] of cases) {
      expect(projectHunkSessionRequest(parseHunkSessionRequest(input), resolver).action).toBe(
        expectedAction,
      );
    }
  });

  test("maps every reloadable Hunk input without retaining Hunk view options", () => {
    expect(
      projectHunkReviewSource({
        kind: "vcs",
        range: "main...feature",
        staged: false,
        pathspecs: ["src"],
        options: { mode: "split" },
      }),
    ).toEqual({
      kind: "working-tree",
      range: "main...feature",
      staged: false,
      pathspecs: ["src"],
    });
    expect(projectHunkReviewSource({ kind: "show", ref: "HEAD~1", options: {} })).toEqual({
      kind: "commit",
      ref: "HEAD~1",
    });
    expect(projectHunkReviewSource({ kind: "stash-show", options: {} })).toEqual({
      kind: "stash",
    });
    expect(
      projectHunkReviewSource({ kind: "diff", left: "before.ts", right: "after.ts", options: {} }),
    ).toEqual({ kind: "file-pair", oldPath: "before.ts", newPath: "after.ts" });
    expect(projectHunkReviewSource({ kind: "patch", text: "diff --git", options: {} })).toEqual({
      kind: "patch",
      text: "diff --git",
    });
    expect(
      projectHunkReviewSource({
        kind: "difftool",
        left: "/tmp/old",
        right: "/tmp/new",
        path: "src/a.ts",
        options: {},
      }),
    ).toEqual({
      kind: "external-diff",
      oldPath: "/tmp/old",
      newPath: "/tmp/new",
      displayPath: "src/a.ts",
    });
  });

  test("maps exact navigation and note targets onto document and hunk identities", () => {
    const navigate = parseHunkSessionRequest({
      action: "navigate",
      selector: { sessionId: "session-1" },
      filePath: "src/a.ts",
      hunkNumber: 3,
      side: "new",
      line: 14,
    });
    expect(projectHunkSessionRequest(navigate, resolver)).toEqual({
      action: "review.navigate",
      input: {
        sessionId: "session-1",
        target: {
          documentId: "document:src/a.ts",
          hunkId: "hunk:2",
          side: "new",
          line: 14,
        },
      },
    });

    const note = parseHunkSessionRequest({
      action: "comment-add",
      selector: { repoRoot: "/repo" },
      filePath: "src/a.ts",
      side: "old",
      line: 7,
      summary: "Regression",
      rationale: "This drops the fallback.",
      reveal: true,
    });
    expect(projectHunkSessionRequest(note, resolver)).toEqual({
      action: "note.add",
      input: {
        repoRoot: "/repo",
        target: {
          documentId: "document:src/a.ts",
          hunkId: "hunk:0",
          side: "old",
          line: 7,
        },
        summary: "Regression",
        body: "This drops the fallback.",
        reveal: true,
      },
    });
  });

  test("maps Hunk tab commands to the distinct review-workspace level", () => {
    const request = parseHunkSessionRequest({
      action: "tab-rename",
      selector: { sessionPath: "/repo" },
      tab: "backend",
      name: "API review",
    });
    expect(projectHunkSessionRequest(request, resolver)).toEqual({
      action: "workspace.rename",
      input: {
        sessionPath: "/repo",
        workspaceId: "workspace:backend",
        name: "API review",
      },
    });
  });

  test("rejects malformed and unknown Hunk requests before projection", () => {
    expect(() =>
      parseHunkSessionRequest({
        action: "comment-add",
        selector: { sessionId: "session-1" },
        filePath: "src/a.ts",
        side: "middle",
        line: 1,
        summary: "bad",
        reveal: false,
      }),
    ).toThrow(/side/);
    expect(() => parseHunkSessionRequest({ action: "self-destruct" })).toThrow(
      /Invalid Hunk session request/,
    );
  });
});
