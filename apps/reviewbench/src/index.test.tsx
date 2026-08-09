import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testRender } from "@opentui/solid";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { App } from "./app/App";
import { loadProjectShell } from "./app/project";

const workspace: ReviewWorkspaceInfo = {
  id: "workspace-1",
  name: "reviewbench",
  cwd: "/repo",
  repoRoot: "/repo",
  source: { kind: "working-tree", range: "main...feature", staged: false },
  title: "Feature review",
  sourceLabel: "main...feature",
  documents: [
    {
      id: "document:a",
      path: "src/a.ts",
      additions: 2,
      deletions: 1,
      hunkCount: 1,
      patch: "@@ -1 +1 @@\n-const old = 1\n+const next = 2",
      hunks: [{ id: "document:a:hunk:0:1:1", index: 0, header: "@@ -1 +1 @@" }],
    },
    {
      id: "document:b",
      path: "src/b.ts",
      additions: 1,
      deletions: 0,
      hunkCount: 0,
      hunks: [],
    },
  ],
};

const state: ReviewWorkspaceState = {
  id: "workspace-1",
  selectedDocumentId: "document:a",
  selectedHunkId: "document:a:hunk:0:1:1",
  showAgentNotes: true,
  notes: [
    {
      id: "note-1",
      source: "agent",
      documentId: "document:a",
      target: { documentId: "document:a", hunkId: "document:a:hunk:0:1:1", side: "new", line: 1 },
      summary: "Check the boundary",
      body: "The new value changes the public behavior.",
      createdAt: "2026-08-09T12:00:00.000Z",
      editable: true,
    },
  ],
};

async function renderShell() {
  const harness = await testRender(
    () => (
      <App
        workspace={workspace}
        state={state}
        history={[
          {
            id: "1234567890abcdef",
            subject: "Define review protocol",
            author: "Victor",
            relativeDate: "today",
            refs: ["HEAD -> feature"],
          },
        ]}
      />
    ),
    { width: 100, height: 20, exitOnCtrlC: false },
  );
  await harness.flush();
  return harness;
}

describe("Reviewbench project shell loader", () => {
  test("loads changed documents and bounded Git history for one project", async () => {
    const root = await mkdtemp(join(tmpdir(), "reviewbench-shell-"));
    try {
      const run = (args: string[]) => {
        const result = Bun.spawnSync(["git", ...args], { cwd: root });
        expect(result.exitCode).toBe(0);
      };
      run(["init", "-q"]);
      await Bun.write(join(root, "a.ts"), "const value = 1;\n");
      run(["add", "a.ts"]);
      run([
        "-c",
        "user.name=Reviewbench Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "-qm",
        "initial source",
      ]);
      await Bun.write(join(root, "a.ts"), "const value = 2;\n");
      await Bun.write(join(root, "new.ts"), "export const added = true;\n");

      const loaded = loadProjectShell(root);
      expect(loaded.workspace.documents.map((document) => document.path)).toEqual([
        "a.ts",
        "new.ts",
      ]);
      expect(loaded.workspace.documents[0]).toMatchObject({
        additions: 1,
        deletions: 1,
        hunkCount: 1,
      });
      expect(loaded.workspace.documents[0]?.patch).toContain("const value = 2");
      expect(loaded.workspace.documents[1]).toMatchObject({ additions: 1, hunkCount: 1 });
      expect(loaded.workspace.source).toEqual({ kind: "working-tree", staged: false });
      expect(loaded.history[0]?.subject).toBe("initial source");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Reviewbench Solid shell", () => {
  test("renders project chrome, distinct document tabs, and the selected patch", async () => {
    const harness = await renderShell();
    try {
      const frame = harness.captureCharFrame();
      expect(frame).toContain("Reviewbench");
      expect(frame).toContain("reviewbench  ·  /repo");
      expect(frame).toContain("src/a.ts");
      expect(frame).toContain("src/b.ts");
      expect(frame).toContain("main...feature");
      expect(frame).toContain("const next = 2");
      expect(frame).toContain("Check the boundary");
    } finally {
      harness.renderer.destroy();
    }
  });

  test("switches global sidebar surfaces without changing document tabs", async () => {
    const harness = await renderShell();
    try {
      await harness.mockInput.typeText("3");
      await harness.flush();
      const history = harness.captureCharFrame();
      expect(history).toContain("COMMITS");
      expect(history).toContain("Define review protocol");
      expect(history).toContain("src/a.ts");

      await harness.mockInput.typeText("4");
      await harness.flush();
      const notes = harness.captureCharFrame();
      expect(notes).toContain("REVIEW NOTES");
      expect(notes).toContain("Check the boundary");
      expect(notes).toContain("The new value changes the public behavior.");
    } finally {
      harness.renderer.destroy();
    }
  });

  test("shares theme and sidebar settings across every surface", async () => {
    const harness = await renderShell();
    try {
      await harness.mockInput.typeText("b");
      await harness.flush();
      expect(harness.captureCharFrame()).not.toContain("DOCUMENTS");

      await harness.mockInput.typeText("b3t");
      await harness.flush();
      const frame = harness.captureCharFrame();
      expect(frame).toContain("COMMITS");
      expect(frame).toContain("Define review protocol");
    } finally {
      harness.renderer.destroy();
    }
  });
});
