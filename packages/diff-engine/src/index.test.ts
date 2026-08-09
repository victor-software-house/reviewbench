import { describe, expect, test } from "bun:test";
import {
  createDiffPlan,
  expandDiffTabs,
  measureWrappedSpans,
  packageIdentity,
  REVIEWBENCH_DARK_THEME,
  REVIEWBENCH_LIGHT_THEME,
  sanitizeDiffText,
  summarizePatch,
} from "./index";

const base = {
  documentId: "document:src/example.ts",
  path: "src/example.ts",
  width: 80,
  wrap: true,
  theme: REVIEWBENCH_DARK_THEME,
} as const;

describe("diff-engine package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("diff-engine");
  });

  test("builds split and stack plans from unsaved buffers", async () => {
    const source = {
      ...base,
      before: "const value = 1;\n",
      after: "const value = 2;\n",
    } as const;
    const split = await createDiffPlan({ ...source, layout: "split" });
    const stack = await createDiffPlan({ ...source, layout: "stack" });

    expect(split.rows.map((row) => row.type)).toEqual(["hunk", "split"]);
    expect(stack.rows.map((row) => row.type)).toEqual(["hunk", "stack", "stack"]);
    expect(split.rowOffsets).toEqual([0, 1]);
    expect(split.totalHeight).toBe(2);
  });

  test("preserves exact syntax scope colors and word emphasis", async () => {
    const plan = await createDiffPlan({
      ...base,
      before: "const value = 1;\n",
      after: "const value = 2;\n",
      layout: "split",
    });
    const row = plan.rows.find((candidate) => candidate.type === "split");
    expect(row?.type).toBe("split");
    if (row?.type !== "split") throw new Error("expected split row");

    const variable = row.right.spans.find((span) => span.text === "value");
    const changed = row.right.spans.find((span) => span.text === "2");
    expect(variable?.fg?.toLowerCase()).toBe("#79c0ff");
    expect(changed).toMatchObject({ emphasis: true, bg: "#264f35" });
  });

  test("measures tabs, CJK, and wrapped terminal-cell geometry", () => {
    expect(expandDiffTabs("a\t界", 4)).toBe("a   界");
    expect(expandDiffTabs("\tvalue", 4)).toBe("    value");
    expect(sanitizeDiffText("safe\u001b[31mred\u001b[0m\u0007")).toBe("safered");
    expect(measureWrappedSpans([{ text: "界界界" }], 4, true)).toBe(2);
    expect(measureWrappedSpans([{ text: "界界界" }], 4, false)).toBe(1);
  });

  test("represents collapsed context gaps and exact annotation anchors", async () => {
    const before = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
    const after = [...before];
    after[0] = "changed first";
    after[15] = "changed later";
    const preliminary = await createDiffPlan({
      ...base,
      before: `${before.join("\n")}\n`,
      after: `${after.join("\n")}\n`,
      layout: "stack",
    });
    const secondHunk = preliminary.rows.find((row) => row.type === "hunk" && row.hunkIndex === 1);
    expect(secondHunk?.type).toBe("hunk");
    if (secondHunk?.type !== "hunk") throw new Error("expected second hunk");

    const plan = await createDiffPlan({
      ...base,
      before: `${before.join("\n")}\n`,
      after: `${after.join("\n")}\n`,
      layout: "stack",
      annotations: [
        {
          id: "note-1",
          hunkId: secondHunk.hunkId,
          side: "new",
          line: 16,
          summary: "Why this line changed",
        },
      ],
    });
    const foldIndex = plan.rows.findIndex((row) => row.type === "fold");
    const changedIndex = plan.rows.findIndex(
      (row) => row.type === "stack" && row.cell.newLine === 16,
    );
    const noteIndex = plan.rows.findIndex((row) => row.type === "note");
    expect(foldIndex).toBeGreaterThan(0);
    expect(noteIndex).toBe(changedIndex + 1);
  });

  test("changes syntax output when the active theme changes", async () => {
    const input = {
      ...base,
      before: "const value = 'old';\n",
      after: "const value = 'new';\n",
      layout: "stack" as const,
    };
    const dark = await createDiffPlan(input);
    const light = await createDiffPlan({ ...input, theme: REVIEWBENCH_LIGHT_THEME });
    const darkLine = dark.rows.find((row) => row.type === "stack" && row.cell.kind === "addition");
    const lightLine = light.rows.find(
      (row) => row.type === "stack" && row.cell.kind === "addition",
    );
    if (darkLine?.type !== "stack" || lightLine?.type !== "stack") {
      throw new Error("expected stack additions");
    }
    const darkColors = darkLine.cell.spans.map((span) => span.fg);
    const lightColors = lightLine.cell.spans.map((span) => span.fg);
    expect(darkColors).not.toEqual(lightColors);
  });

  test("bounds large plans with an explicit terminal row", async () => {
    const before = Array.from({ length: 30 }, (_, index) => `old ${index}`).join("\n");
    const after = Array.from({ length: 30 }, (_, index) => `new ${index}`).join("\n");
    const plan = await createDiffPlan({
      ...base,
      before,
      after,
      layout: "stack",
      maxRows: 5,
    });
    expect(plan.rows).toHaveLength(5);
    expect(plan.rows.at(-1)?.type).toBe("truncated");
    expect(plan.truncated).toBe(true);
  });

  test("summarizes patch hunks with the same identities used by plans", () => {
    const patch = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");
    const summary = summarizePatch(base.documentId, base.path, patch);
    expect(summary).toMatchObject({ additions: 1, deletions: 1, hunkCount: 1 });
    expect(summary.hunks[0]?.id).toBe(`${base.documentId}:hunk:0:1:1`);
  });
});
