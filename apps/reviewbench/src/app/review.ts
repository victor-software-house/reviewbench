import type { ReviewNote, ReviewWorkspaceState } from "@victor-software-house/reviewbench-protocol";
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

  const removeNote = (noteId: string) => {
    setNotes((current) => current.filter((note) => note.id !== noteId));
    if (selectedNoteId() === noteId) setSelectedNoteId(null);
  };

  return { notes, selectedNoteId, selectedNote, selectNote: setSelectedNoteId, removeNote };
}

export type ReviewController = ReturnType<typeof createReview>;
