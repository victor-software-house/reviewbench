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
  const initialDocument = info.documents.find(
    (document) => document.id === (state.selectedDocumentId ?? info.documents[0]?.id),
  );
  const [selectedHunkId, setSelectedHunkId] = createSignal<string | null>(
    state.selectedHunkId ?? initialDocument?.hunks[0]?.id ?? null,
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

  const moveDocument = (delta: number) => {
    if (info.documents.length === 0) return;
    const current = Math.max(
      0,
      info.documents.findIndex((document) => document.id === activeDocumentId()),
    );
    const next = (current + delta + info.documents.length) % info.documents.length;
    const document = info.documents[next];
    if (document) openDocument(document.id);
  };

  const moveHunk = (delta: number) => {
    const targets = info.documents.flatMap((document) =>
      document.hunks.map((hunk) => ({ documentId: document.id, hunkId: hunk.id })),
    );
    if (targets.length === 0) return;
    const current = targets.findIndex((target) => target.hunkId === selectedHunkId());
    const origin = current < 0 ? (delta > 0 ? -1 : 0) : current;
    const next = (origin + delta + targets.length) % targets.length;
    const target = targets[next];
    if (target) navigate(target.documentId, target.hunkId);
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
    moveDocument,
    moveHunk,
  };
}

export type WorkspaceController = ReturnType<typeof createWorkspace>;
