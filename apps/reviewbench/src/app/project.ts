import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizePatch } from "@victor-software-house/reviewbench-diff-engine";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import type { GitHistoryEntry } from "./history";

function git(cwd: string, args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return result.exitCode === 0 ? result.stdout.toString() : "";
}

/** Encode an untracked text file as a minimal unified patch without a platform-specific null path. */
function untrackedPatch(root: string, path: string) {
  const text = readFileSync(resolve(root, path), "utf8");
  if (text.includes("\0")) return "";
  const hasFinalNewline = text.endsWith("\n");
  const lines = text.split("\n");
  if (hasFinalNewline) lines.pop();
  const body = lines.map((line) => `+${line}`).join("\n");
  const missingNewline =
    !hasFinalNewline && lines.length > 0 ? "\n\\ No newline at end of file" : "";
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    `${body}${missingNewline}`,
    "",
  ].join("\n");
}

/** Load the narrow project facts needed by the shell without owning diff parsing or rendering. */
export function loadProjectShell(path = process.cwd()): {
  workspace: ReviewWorkspaceInfo;
  state: ReviewWorkspaceState;
  history: GitHistoryEntry[];
} {
  const cwd = resolve(path);
  const repoRoot = git(cwd, ["rev-parse", "--show-toplevel"]).trim() || undefined;
  const root = repoRoot ?? cwd;
  const trackedPaths = git(root, ["diff", "--name-only", "-z", "HEAD"]).split("\0").filter(Boolean);
  const untrackedPaths = git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean);
  const untracked = new Set(untrackedPaths);
  const documentPaths = [...new Set([...trackedPaths, ...untrackedPaths])].toSorted();
  const documents = documentPaths.map((documentPath) => {
    const id = `document:${documentPath}`;
    const patch = untracked.has(documentPath)
      ? untrackedPatch(root, documentPath)
      : git(root, ["diff", "--binary", "HEAD", "--", documentPath]);
    const summary = summarizePatch(id, documentPath, patch);
    return {
      id,
      path: documentPath,
      ...summary,
      ...(patch ? { patch } : {}),
    };
  });
  const history: GitHistoryEntry[] = [];
  const historyRecords = git(root, [
    "log",
    "-20",
    "--format=%H%x1f%s%x1f%an%x1f%ar%x1f%D%x1e",
  ]).split("\x1e");
  for (const record of historyRecords) {
    const [id, subject, author, relativeDate, refs] = record.trim().split("\x1f");
    if (!id || subject === undefined || !author || !relativeDate) continue;
    history.push({
      id,
      subject,
      author,
      relativeDate,
      ...(refs ? { refs: refs.split(", ").filter(Boolean) } : {}),
    });
  }

  const workspaceId = `workspace:${root}`;
  const selectedDocumentId = documents[0]?.id;
  return {
    workspace: {
      id: workspaceId,
      name: root.split(/[\\/]/).at(-1) ?? root,
      cwd,
      ...(repoRoot === undefined ? {} : { repoRoot }),
      source: { kind: "working-tree", staged: false },
      title: "Working tree review",
      sourceLabel: "git diff",
      documents,
    },
    state: {
      id: workspaceId,
      ...(selectedDocumentId === undefined ? {} : { selectedDocumentId }),
      showAgentNotes: true,
      notes: [],
    },
    history,
  };
}
