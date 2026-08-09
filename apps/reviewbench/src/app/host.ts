import type {
  ReviewSessionCommandResult,
  ReviewSessionServerMessage,
  ReviewSessionState,
  ReviewTarget,
} from "@victor-software-house/reviewbench-protocol";
import type { ReviewController } from "./review";
import type { WorkspaceController } from "./workspace";

export interface ReviewbenchHost {
  dispatchCommand(message: ReviewSessionServerMessage): Promise<ReviewSessionCommandResult>;
  snapshot(): ReviewSessionState;
}

function targetHunkId(target?: ReviewTarget) {
  return target && "hunkId" in target ? target.hunkId : undefined;
}

/** Adapt app controllers onto the product-neutral command contract the broker carries. */
export function createReviewbenchHost(deps: {
  workspace: WorkspaceController;
  review: ReviewController;
}): ReviewbenchHost {
  const { workspace, review } = deps;

  return {
    snapshot: () => ({
      activeWorkspaceId: workspace.info.id,
      workspaces: [
        {
          id: workspace.info.id,
          ...(workspace.activeDocumentId() === null
            ? {}
            : { selectedDocumentId: workspace.activeDocumentId() ?? undefined }),
          ...(workspace.selectedHunkId() === null
            ? {}
            : { selectedHunkId: workspace.selectedHunkId() ?? undefined }),
          showAgentNotes: workspace.state.showAgentNotes,
          ...(workspace.state.noteMarkupWidth === undefined
            ? {}
            : { noteMarkupWidth: workspace.state.noteMarkupWidth }),
          notes: review.notes(),
        },
      ],
    }),
    dispatchCommand: async (message) => {
      switch (message.command) {
        case "review.navigate": {
          const target = message.input.target;
          if (!target) throw new Error("Review navigation requires one exact target.");
          workspace.navigate(target.documentId, targetHunkId(target));
          const hunkId = targetHunkId(target) ?? workspace.selectedHunkId();
          if (!hunkId) throw new Error("The selected document has no review hunk.");
          return {
            workspaceId: workspace.info.id,
            documentId: target.documentId,
            hunkId,
            ...("side" in target ? { target } : {}),
          };
        }
        case "note.add": {
          const note = review.addNote(message.input);
          if (message.input.reveal ?? false) {
            workspace.navigate(note.documentId, targetHunkId(note.target));
          }
          return { noteIds: [note.id], remainingNoteCount: review.notes().length };
        }
        case "note.add-batch": {
          const noteIds = message.input.notes.map((input) => review.addNote(input).id);
          return { noteIds, remainingNoteCount: review.notes().length };
        }
        case "note.remove": {
          const before = review.notes().length;
          review.removeNote(message.input.noteId);
          return {
            noteIds: before === review.notes().length ? [] : [message.input.noteId],
            remainingNoteCount: review.notes().length,
          };
        }
        case "note.clear": {
          const noteIds = review.notes().map((note) => note.id);
          for (const noteId of noteIds) review.removeNote(noteId);
          return { noteIds, remainingNoteCount: review.notes().length };
        }
        case "review.reload":
        case "workspace.add":
        case "workspace.select":
        case "workspace.rename":
        case "workspace.close":
          throw new Error(`Reviewbench does not support ${message.command} in this spike.`);
      }
      message satisfies never;
      throw new Error("Unsupported Reviewbench host command.");
    },
  };
}
