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
  const [selectedHunkId, setSelectedHunkId] = createSignal<string | null>(
    state.selectedHunkId ?? null,
  );

  const openDocument = (documentId: string) => {
    if (!documents.has(documentId)) return;
    setTabIds((ids) => (ids.includes(documentId) ? ids : [...ids, documentId]));
    setActiveDocumentId(documentId);
    const document = documents.get(documentId);
    if (!document?.hunks.some((hunk) => hunk.id === selectedHunkId())) {
      setSelectedHunkId(document?.hunks[0]?.id ?? null);
    }
  };

  const navigate = (documentId: string, hunkId?: string) => {
    const document = documents.get(documentId);
    if (!document) throw new Error(`Unknown review document ${documentId}.`);
    if (hunkId && !document.hunks.some((hunk) => hunk.id === hunkId)) {
      throw new Error(`Unknown review hunk ${hunkId} in ${document.path}.`);
    }
    openDocument(documentId);
    setSelectedHunkId(hunkId ?? document.hunks[0]?.id ?? null);
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
    selectedHunkId,
    openDocument,
    closeDocument,
    navigate,
  };
}

export type WorkspaceController = ReturnType<typeof createWorkspace>;
