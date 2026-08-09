import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { App } from "./app/App";
import type { ReviewbenchHost } from "./app/host";
import { loadProjectShell } from "./app/project";
import { createWorkspace } from "./app/workspace";
import { colorsFor } from "./ui/theme";

function capturedColorToHex(color: { buffer?: ArrayLike<number> } | undefined) {
  const buffer = color?.buffer;
  if (!buffer || buffer[0] == null || buffer[1] == null || buffer[2] == null) return null;
  const byteScale = [buffer[0], buffer[1], buffer[2]].some((value) => value > 1);
  const component = (value: number) =>
    Math.max(0, Math.min(255, Math.round(byteScale ? value : value * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${component(buffer[0])}${component(buffer[1])}${component(buffer[2])}`;
}

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
      hunkCount: 1,
      patch: "@@ -0,0 +1 @@\n+export const b = true",
      hunks: [{ id: "document:b:hunk:0:0:1", index: 0, header: "@@ -0,0 +1 @@" }],
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
  test("traverses exact hunk identities in document order", () => {
    const secondHunk = { id: "document:a:hunk:1:20:20", index: 1, header: "@@ -20 +20 @@" };
    const [firstDocument, secondDocument] = workspace.documents;
    if (!firstDocument || !secondDocument) throw new Error("Expected two fixture documents.");
    const controller = createWorkspace(
      {
        ...workspace,
        documents: [
          { ...firstDocument, hunks: [...firstDocument.hunks, secondHunk] },
          secondDocument,
        ],
      },
      { id: state.id, showAgentNotes: state.showAgentNotes, notes: state.notes },
    );

    expect(controller.selectedHunkId()).toBe("document:a:hunk:0:1:1");
    expect(controller.revealRequestId()).toBe(0);
    controller.moveHunk(1);
    expect(controller.selectedHunkId()).toBe(secondHunk.id);
    expect(controller.revealRequestId()).toBe(1);
    controller.moveHunk(1);
    expect(controller.selectedHunkId()).toBe("document:b:hunk:0:0:1");
    expect(controller.activeDocumentId()).toBe("document:b");
    controller.moveHunk(-1);
    expect(controller.selectedHunkId()).toBe(secondHunk.id);

    const revealRequestId = controller.revealRequestId();
    controller.syncViewport("document:b", "document:b:hunk:0:0:1");
    expect(controller.activeDocumentId()).toBe("document:b");
    expect(controller.selectedHunkId()).toBe("document:b:hunk:0:0:1");
    expect(controller.revealRequestId()).toBe(revealRequestId);
  });

  test("renders a compact review hierarchy instead of scaffold chrome", async () => {
    const harness = await renderShell();
    try {
      const frame = harness.captureCharFrame();
      expect(frame).toContain("Reviewbench  /  reviewbench");
      expect(frame).toContain("WORKING TREE");
      expect(frame).toContain("CHANGES  2 files");
      expect(frame).toContain("M  src/a.ts");
      expect(frame).toContain("+2 -1");
      expect(frame).toContain("src/b.ts");
      expect(frame).toContain("const next = 2");
      expect(frame).toContain("export const b = true");
      expect(frame).toContain("Check the boundary");
      expect(frame).toContain("▎ @@");
      expect(frame).toContain("[ / ] hunks");
      expect(frame).toContain(", / . files");
      expect(frame).toContain("s sidebar");
      expect(frame).toContain("q quit");
      expect(frame).not.toContain("reviewbench  ·  /repo");

      const selectedLine = harness.captureSpans().lines.find((line) =>
        line.spans
          .map((span) => span.text)
          .join("")
          .includes("M  src/a.ts"),
      );
      expect(
        selectedLine?.spans.some(
          (span) => capturedColorToHex(span.bg)?.toLowerCase() === colorsFor("dark").selected,
        ),
      ).toBe(true);
    } finally {
      harness.renderer.destroy();
    }
  });

  test("switches global sidebar surfaces without changing document tabs", async () => {
    const harness = await renderShell();
    try {
      await harness.mockMouse.click(13, 2);
      await harness.flush();
      const history = harness.captureCharFrame();
      expect(history).toContain("COMMITS");
      expect(history).toContain("Define review protocol");
      expect(history).toContain("src/a.ts");

      await harness.mockMouse.click(20, 2);
      await harness.flush();
      const notes = harness.captureCharFrame();
      expect(notes).toContain("REVIEW NOTES");
      expect(notes).toContain("Check the boundary");
      expect(notes).toContain("The new value changes the public behavior.");
    } finally {
      harness.renderer.destroy();
    }
  });

  test("keeps every document mounted while file and agent navigation reveal exact targets", async () => {
    const tallPatch = [
      "@@ -1,12 +1,12 @@",
      ...Array.from({ length: 12 }, (_, index) => `-const old${index} = ${index}`),
      ...Array.from({ length: 12 }, (_, index) => `+const next${index} = ${index + 1}`),
    ].join("\n");
    const [firstDocument, secondDocument] = workspace.documents;
    if (!firstDocument || !secondDocument) throw new Error("Expected two fixture documents.");
    const streamWorkspace: ReviewWorkspaceInfo = {
      ...workspace,
      documents: [
        {
          ...firstDocument,
          patch: tallPatch,
          additions: 12,
          deletions: 12,
          hunks: [{ id: "document:a:hunk:0:1:1", index: 0, header: "@@ -1,12 +1,12 @@" }],
        },
        {
          ...secondDocument,
          patch: "@@ -0,0 +1 @@\n+export const second_target = true",
        },
      ],
    };
    let host: ReviewbenchHost | undefined;
    const harness = await testRender(
      () => (
        <App
          workspace={streamWorkspace}
          state={state}
          onHostReady={(readyHost) => {
            host = readyHost;
          }}
        />
      ),
      { width: 100, height: 10, exitOnCtrlC: false },
    );

    try {
      await harness.flush();
      expect(
        harness.renderer.root.findDescendantById("review-stream-section:document:a"),
      ).toBeDefined();
      expect(
        harness.renderer.root.findDescendantById("review-stream-section:document:b"),
      ).toBeDefined();
      expect(harness.captureCharFrame()).not.toContain("second_target");
      expect(harness.renderer.root.findDescendantById("review-stream-scrollbar")).toBeUndefined();

      await harness.mockInput.typeText("j");
      await harness.flush();
      const scrollBox = harness.renderer.root.findDescendantById("review-stream-scroll");
      const thumb = harness.renderer.root.findDescendantById("review-stream-scrollbar-thumb");
      const track = harness.renderer.root.findDescendantById("review-stream-scrollbar-track");
      if (!scrollBox || !thumb || !track) throw new Error("Expected Hunk-style scrollbar.");
      const afterStep = (scrollBox as ScrollBoxRenderable).scrollTop;
      await harness.mockMouse.drag(
        thumb.x,
        thumb.y,
        thumb.x,
        Math.min(track.y + track.height - 1, thumb.y + 2),
      );
      await harness.flush();
      const afterDrag = (scrollBox as ScrollBoxRenderable).scrollTop;
      expect(afterDrag).toBeGreaterThan(afterStep);
      await harness.mockMouse.click(track.x, track.y);
      await harness.flush();
      expect((scrollBox as ScrollBoxRenderable).scrollTop).toBeLessThan(afterDrag);

      await harness.mockInput.typeText("]");
      await harness.flush();
      expect(harness.captureCharFrame()).toContain("second_target");

      await harness.mockInput.typeText("g");
      await harness.flush();
      await harness.mockInput.typeText(".");
      await harness.flush();
      expect(harness.captureCharFrame()).toContain("second_target");

      await harness.mockInput.typeText("g");
      await harness.flush();
      expect(harness.captureCharFrame()).toContain("const old0 = 0");

      if (!host) throw new Error("Expected Reviewbench host.");
      expect(host.snapshot().workspaces[0]?.selectedDocumentId).toBe("document:a");
      await host.dispatchCommand({
        type: "command",
        requestId: "navigate-b",
        command: "review.navigate",
        input: {
          sessionId: "session-1",
          target: { documentId: "document:b", hunkId: "document:b:hunk:0:0:1" },
        },
      });
      await harness.flush();
      expect(harness.captureCharFrame()).toContain("second_target");

      await Bun.sleep(2_100);
      await harness.flush();
      expect(harness.renderer.root.findDescendantById("review-stream-scrollbar")).toBeUndefined();
    } finally {
      harness.renderer.destroy();
    }
  });

  test("uses Hunk bindings for files, layout, sidebar, theme, and wrapping", async () => {
    const harness = await renderShell();
    try {
      await harness.mockInput.typeText(".");
      await harness.flush();
      expect(harness.captureCharFrame()).toContain("A  src/b.ts");

      await harness.mockInput.typeText(",1");
      await harness.flush();
      const split = harness.captureCharFrame();
      expect(split).toContain("M  src/a.ts");
      expect(split).toContain("│");

      await harness.mockInput.typeText("s");
      await harness.flush();
      expect(harness.captureCharFrame()).not.toContain("CHANGES");

      await harness.mockInput.typeText("stw");
      await harness.flush();
      expect(harness.captureCharFrame()).toContain("CHANGES");
    } finally {
      harness.renderer.destroy();
    }
  });

  test("shares theme and sidebar settings across every surface", async () => {
    const harness = await renderShell();
    try {
      await harness.mockInput.typeText("s");
      await harness.flush();
      expect(harness.captureCharFrame()).not.toContain("CHANGES");

      await harness.mockInput.typeText("s");
      await harness.flush();
      await harness.mockMouse.click(13, 2);
      await harness.mockInput.typeText("t");
      await harness.flush();
      const frame = harness.captureCharFrame();
      expect(frame).toContain("COMMITS");
      expect(frame).toContain("Define review protocol");
    } finally {
      harness.renderer.destroy();
    }
  });
});
