import { resolve } from "node:path";
import type {
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import type { GitHistoryEntry } from "./history";

function git(cwd: string, args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return result.exitCode === 0 ? result.stdout.toString() : "";
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
  const documentPaths = [
    ...new Set(
      [
        ...git(root, ["diff", "--name-only", "-z", "HEAD"]).split("\0"),
        ...git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
      ].filter(Boolean),
    ),
  ].toSorted();
  const documents = documentPaths.map((documentPath) => ({
    id: `document:${documentPath}`,
    path: documentPath,
    additions: 0,
    deletions: 0,
    hunkCount: 0,
    hunks: [],
  }));
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
