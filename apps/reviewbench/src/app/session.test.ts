import { afterEach, describe, expect, test } from "bun:test";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { createReviewbenchHost } from "./host";
import { createReview } from "./review";
import {
  HUNK_SESSION_API_PATH,
  HUNK_SESSION_CAPABILITIES_PATH,
  type ReviewbenchSessionRuntime,
  startReviewbenchSessionRuntime,
} from "./session";
import { createWorkspace } from "./workspace";

const workspaceInfo: ReviewWorkspaceInfo = {
  id: "workspace-1",
  name: "main",
  cwd: "/repo",
  repoRoot: "/repo",
  source: { kind: "working-tree", staged: false },
  title: "Working tree review",
  sourceLabel: "git diff",
  documents: [
    {
      id: "document:a",
      path: "src/a.ts",
      additions: 1,
      deletions: 1,
      hunkCount: 1,
      patch: "@@ -1 +1 @@\n-old\n+new",
      hunks: [
        {
          id: "hunk:a:0",
          index: 0,
          header: "@@ -1 +1 @@",
          oldRange: [1, 1],
          newRange: [1, 1],
        },
      ],
    },
  ],
};

const workspaceState: ReviewWorkspaceState = {
  id: "workspace-1",
  selectedDocumentId: "document:a",
  selectedHunkId: "hunk:a:0",
  showAgentNotes: true,
  notes: [],
};

const runtimes = new Set<ReviewbenchSessionRuntime>();
afterEach(() => {
  for (const runtime of runtimes) runtime.stop();
  runtimes.clear();
});

async function request(runtime: ReviewbenchSessionRuntime, body: unknown) {
  const response = await fetch(`${runtime.origin}${HUNK_SESSION_API_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}

async function start() {
  const workspace = createWorkspace(workspaceInfo, workspaceState);
  const review = createReview(workspaceState);
  const host = createReviewbenchHost({ workspace, review });
  const runtime = startReviewbenchSessionRuntime({
    host,
    workspace: workspaceInfo,
    state: workspaceState,
  });
  runtimes.add(runtime);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = (await fetch(`${runtime.origin}/health`).then((response) =>
      response.json(),
    )) as {
      sessions: number;
    };
    if (health.sessions === 1) return { runtime, host };
    await Bun.sleep(5);
  }
  throw new Error("Reviewbench session did not register with its Bun daemon.");
}

describe("Reviewbench Hunk-compatible session slice", () => {
  test("advertises only the existing-compatible actions implemented by the spike", async () => {
    const { runtime } = await start();
    const capabilities = await fetch(`${runtime.origin}${HUNK_SESSION_CAPABILITIES_PATH}`).then(
      (response) => response.json(),
    );
    expect(capabilities).toEqual({
      version: 1,
      daemonVersion: 7,
      actions: [
        "list",
        "get",
        "context",
        "review",
        "navigate",
        "comment-add",
        "comment-list",
        "comment-rm",
      ],
    });
  });

  test("lists, inspects, navigates, adds, lists, and removes a note through the daemon", async () => {
    const { runtime, host } = await start();
    const selector = { sessionId: runtime.sessionId };

    const listed = (await request(runtime, { action: "list" })) as {
      sessions: Array<{ sessionId: string; tabs: Array<{ files: Array<{ path: string }> }> }>;
    };
    expect(listed.sessions[0]?.sessionId).toBe(runtime.sessionId);
    expect(listed.sessions[0]?.tabs[0]?.files[0]?.path).toBe("src/a.ts");

    const context = (await request(runtime, { action: "context", selector })) as {
      context: { tab: { selectedFile: { path: string }; selectedHunk: { index: number } } };
    };
    expect(context.context.tab.selectedFile.path).toBe("src/a.ts");
    expect(context.context.tab.selectedHunk.index).toBe(0);

    const navigated = (await request(runtime, {
      action: "navigate",
      selector,
      filePath: "src/a.ts",
      side: "new",
      line: 1,
    })) as { result: { filePath: string; hunkIndex: number } };
    expect(navigated.result).toMatchObject({ filePath: "src/a.ts", hunkIndex: 0 });

    const added = (await request(runtime, {
      action: "comment-add",
      selector,
      filePath: "src/a.ts",
      side: "new",
      line: 1,
      summary: "Preserve the boundary",
      rationale: "The caller depends on this value.",
      reveal: true,
    })) as { result: { commentId: string } };
    expect(added.result.commentId).toStartWith("agent:");
    expect(host.snapshot().workspaces[0]?.notes).toHaveLength(1);

    const comments = (await request(runtime, {
      action: "comment-list",
      selector,
      type: "agent",
    })) as { comments: Array<{ noteId: string; body: string }> };
    expect(comments.comments).toEqual([
      expect.objectContaining({
        noteId: added.result.commentId,
        body: "The caller depends on this value.",
      }),
    ]);

    const removed = (await request(runtime, {
      action: "comment-rm",
      selector,
      commentId: added.result.commentId,
    })) as { result: { removed: boolean; remainingCommentCount: number } };
    expect(removed.result).toMatchObject({ removed: true, remainingCommentCount: 0 });
    expect(host.snapshot().workspaces[0]?.notes).toEqual([]);
  });
});
