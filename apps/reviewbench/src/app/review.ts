import type {
  AddReviewNoteInput,
  ReviewNote,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { createMemo, createSignal } from "solid-js";

/** Own review-note selection without reaching into workspace or UI internals. */
export function createReview(state: ReviewWorkspaceState) {
  const [notes, setNotes] = createSignal<ReviewNote[]>(state.notes);
  const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(
    state.notes[0]?.id ?? null,
  );
  const selectedNote = createMemo(
    () => notes().find((note) => note.id === selectedNoteId()) ?? null,
  );
  let nextNote = 0;

  const addNote = (
    input: Omit<AddReviewNoteInput, "sessionId" | "sessionPath" | "repoRoot" | "workspaceId">,
  ) => {
    const id = `agent:${Date.now().toString(36)}:${nextNote++}`;
    const note: ReviewNote = {
      id,
      source: "agent",
      documentId: input.target.documentId,
      target: input.target,
      summary: input.summary,
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.markup === undefined ? {} : { markup: input.markup }),
      ...(input.author === undefined ? {} : { author: input.author }),
      createdAt: new Date().toISOString(),
      editable: true,
    };
    setNotes((current) => [...current, note]);
    setSelectedNoteId(id);
    return note;
  };

  const removeNote = (noteId: string) => {
    setNotes((current) => current.filter((note) => note.id !== noteId));
    if (selectedNoteId() === noteId) setSelectedNoteId(null);
  };

  return {
    notes,
    selectedNoteId,
    selectedNote,
    selectNote: setSelectedNoteId,
    addNote,
    removeNote,
  };
}

export type ReviewController = ReturnType<typeof createReview>;
