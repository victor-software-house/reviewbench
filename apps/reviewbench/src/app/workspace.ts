import type {
  ReviewDocument,
  ReviewWorkspaceInfo,
  ReviewWorkspaceState,
} from "@victor-software-house/reviewbench-protocol";
import { createMemo, createSignal } from "solid-js";

/** Own document tabs inside one review workspace; workspace identity remains a separate level. */
export function createWorkspace(info: ReviewWorkspaceInfo, state: ReviewWorkspaceState) {
  const documents = new Map(info.documents.map((document) => [document.id, document]));
  const initialTabs = info.documents.map((document) => document.id);
  const [tabIds, setTabIds] = createSignal(initialTabs);
  const [activeDocumentId, setActiveDocumentId] = createSignal<string | null>(
    state.selectedDocumentId ?? info.documents[0]?.id ?? null,
  );

  const openDocument = (documentId: string) => {
    if (!documents.has(documentId)) return;
    setTabIds((ids) => (ids.includes(documentId) ? ids : [...ids, documentId]));
    setActiveDocumentId(documentId);
  };

  const closeDocument = (documentId: string) => {
    const current = tabIds();
    const closedIndex = current.indexOf(documentId);
    const next = current.filter((id) => id !== documentId);
    setTabIds(next);
    if (activeDocumentId() === documentId) {
      setActiveDocumentId(next[closedIndex] ?? next[closedIndex - 1] ?? null);
    }
  };

  const activeDocument = createMemo<ReviewDocument | null>(() => {
    const id = activeDocumentId();
    return id ? (documents.get(id) ?? null) : null;
  });

  const tabs = createMemo(() =>
    tabIds().flatMap((id) => {
      const document = documents.get(id);
      return document ? [document] : [];
    }),
  );

  return {
    info,
    state,
    documents: info.documents,
    tabs,
    activeDocumentId,
    activeDocument,
    openDocument,
    closeDocument,
  };
}

export type WorkspaceController = ReturnType<typeof createWorkspace>;
