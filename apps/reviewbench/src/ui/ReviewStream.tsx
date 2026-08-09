import type { ScrollBoxRenderable } from "@opentui/core";
import { MacOSScrollAccel } from "@opentui/core";
import {
  computeHunkRevealScrollTop,
  createDiffPlan,
  type DiffAnnotation,
  type DiffRenderPlan,
  type DiffTheme,
  MAX_PLAN_ROWS,
} from "@victor-software-house/reviewbench-diff-engine";
import type { ReviewDocument, ReviewNote } from "@victor-software-house/reviewbench-protocol";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { DiffView, reviewStreamRowId } from "./DiffView";
import type { ShellColors } from "./theme";
import { VerticalScrollbar } from "./VerticalScrollbar";

const MAX_STREAM_PLAN_ROWS = 50_000;

interface ReviewStreamSection {
  document: ReviewDocument;
  plan: DiffRenderPlan | null;
  error: string | null;
}

interface ReviewStreamProps {
  documents: readonly ReviewDocument[];
  notes: readonly ReviewNote[];
  width: number;
  wrap: boolean;
  theme: DiffTheme;
  layout: "auto" | "split" | "stack";
  activeDocumentId: string | null;
  selectedHunkId: string | null;
  revealRequestId: number;
  colors: ShellColors;
  onSelectTarget: (documentId: string, hunkId?: string) => void;
  onViewportTarget: (documentId: string, hunkId?: string) => void;
  onScrollReady: (scrollBox: ScrollBoxRenderable | undefined) => void;
}

/** Stable OpenTUI identity for one document section in the continuous stream. */
export function reviewStreamSectionId(documentId: string) {
  return `review-stream-section:${documentId}`;
}

function reviewStreamFileId(documentId: string) {
  return `review-stream-file:${documentId}`;
}

function annotationsFor(documentId: string, notes: readonly ReviewNote[]): DiffAnnotation[] {
  return notes.flatMap((note) => {
    if (note.documentId !== documentId || !note.target || !("hunkId" in note.target)) return [];
    return [
      {
        id: note.id,
        summary: note.summary,
        ...(note.body === undefined ? {} : { body: note.body }),
        hunkId: note.target.hunkId,
        ...(note.target && "side" in note.target ? { side: note.target.side } : {}),
        ...(note.target && "line" in note.target ? { line: note.target.line } : {}),
      },
    ];
  });
}

/** Share one bounded row budget while keeping every file section present. */
function planRowsPerDocument(documentCount: number) {
  return Math.max(1, Math.min(MAX_PLAN_ROWS, Math.floor(MAX_STREAM_PLAN_ROWS / documentCount)));
}

/** One ordered, scrollable review surface for every changed document. */
export function ReviewStream(props: ReviewStreamProps) {
  let scrollBox: ScrollBoxRenderable | undefined;
  let previousScrollTop = 0;
  let viewportReadScheduled = false;
  const scrollAcceleration = new MacOSScrollAccel({ A: 0.4, tau: 4, maxMultiplier: 3 });
  const [mountedScrollBox, setMountedScrollBox] = createSignal<ScrollBoxRenderable>();
  const [scrollMetrics, setScrollMetrics] = createSignal({
    scrollTop: 0,
    viewportHeight: 0,
    contentHeight: 0,
  });
  const [scrollbarActivityId, setScrollbarActivityId] = createSignal(0);
  const [sections] = createResource(
    () => ({
      documents: props.documents,
      notes: props.notes,
      width: props.width,
      wrap: props.wrap,
      theme: props.theme,
      layout: props.layout,
    }),
    async (input): Promise<ReviewStreamSection[]> => {
      const maxRows = planRowsPerDocument(Math.max(1, input.documents.length));
      return Promise.all(
        input.documents.map(async (document) => {
          if (!document.patch) return { document, plan: null, error: null };
          try {
            const plan = await createDiffPlan({
              documentId: document.id,
              path: document.path,
              patch: document.patch,
              layout:
                input.layout === "auto" ? (input.width >= 100 ? "split" : "stack") : input.layout,
              width: input.width,
              wrap: input.wrap,
              theme: input.theme,
              annotations: annotationsFor(document.id, input.notes),
              maxRows,
            });
            return { document, plan, error: null };
          } catch (error) {
            return { document, plan: null, error: String(error) };
          }
        }),
      );
    },
  );

  const readViewportTarget = () => {
    viewportReadScheduled = false;
    const currentScrollBox = scrollBox;
    if (!currentScrollBox) return;

    const nextScrollTop = currentScrollBox.scrollTop;
    setScrollMetrics({
      scrollTop: nextScrollTop,
      viewportHeight: currentScrollBox.viewport.height,
      contentHeight: currentScrollBox.scrollHeight,
    });
    if (nextScrollTop !== previousScrollTop) {
      previousScrollTop = nextScrollTop;
      setScrollbarActivityId((activityId) => activityId + 1);
    }

    const currentSections = untrack(sections);
    if (!currentSections || currentSections.length === 0) return;

    const viewportCenter =
      currentScrollBox.viewport.y + Math.floor(Math.max(1, currentScrollBox.viewport.height) / 2);
    let selectedSection = currentSections[0];
    for (const section of currentSections) {
      const sectionNode = currentScrollBox.content.findDescendantById(
        reviewStreamSectionId(section.document.id),
      );
      if (!sectionNode || sectionNode.y > viewportCenter) break;
      selectedSection = section;
    }
    if (!selectedSection) return;

    let hunkId = selectedSection.document.hunks[0]?.id;
    for (const row of selectedSection.plan?.rows ?? []) {
      const rowNode = currentScrollBox.content.findDescendantById(
        reviewStreamRowId(selectedSection.document.id, row.key),
      );
      if (!rowNode || rowNode.y > viewportCenter) break;
      if ("hunkId" in row) hunkId = row.hunkId;
    }

    if (
      selectedSection.document.id !== props.activeDocumentId ||
      (hunkId !== undefined && hunkId !== props.selectedHunkId)
    ) {
      props.onViewportTarget(selectedSection.document.id, hunkId);
    }
  };

  const scheduleViewportRead = () => {
    if (viewportReadScheduled) return;
    viewportReadScheduled = true;
    queueMicrotask(readViewportTarget);
  };

  onMount(() => {
    if (!scrollBox) return;
    const activeScrollBox = scrollBox;
    activeScrollBox.verticalScrollBar.scrollStep = 1;
    activeScrollBox.verticalScrollBar.on("change", scheduleViewportRead);
    activeScrollBox.viewport.on("layout-changed", scheduleViewportRead);
    activeScrollBox.viewport.on("resized", scheduleViewportRead);
    props.onScrollReady(activeScrollBox);
    scheduleViewportRead();
    onCleanup(() => {
      activeScrollBox.verticalScrollBar.off("change", scheduleViewportRead);
      activeScrollBox.viewport.off("layout-changed", scheduleViewportRead);
      activeScrollBox.viewport.off("resized", scheduleViewportRead);
      setMountedScrollBox(undefined);
      props.onScrollReady(undefined);
    });
  });

  createEffect(
    on([() => props.revealRequestId, sections], ([, currentSections]) => {
      if (!scrollBox || !currentSections) return;
      const documentId = untrack(() => props.activeDocumentId);
      const hunkId = untrack(() => props.selectedHunkId);
      if (!documentId) return;
      const section = currentSections.find((candidate) => candidate.document.id === documentId);
      const hunkRow = section?.plan?.rows.find(
        (row) => "hunkId" in row && row.hunkId === hunkId && row.type === "hunk",
      );
      const targetId = hunkRow
        ? reviewStreamRowId(documentId, hunkRow.key)
        : reviewStreamFileId(documentId);
      queueMicrotask(() => {
        const currentScrollBox = scrollBox;
        if (!currentScrollBox) return;
        if (!hunkRow || !section?.plan || !hunkId) {
          currentScrollBox.scrollChildIntoView(targetId);
          return;
        }
        const hunkNode = currentScrollBox.content.findDescendantById(targetId);
        if (!hunkNode) return;
        const hunkTop = currentScrollBox.scrollTop + hunkNode.y - currentScrollBox.viewport.y;
        const hunkHeight = section.plan.rows.reduce(
          (height, row) =>
            "hunkId" in row && row.hunkId === hunkId ? height + row.height : height,
          0,
        );
        currentScrollBox.scrollTo({
          x: currentScrollBox.scrollLeft,
          y: computeHunkRevealScrollTop({
            hunkTop,
            hunkHeight,
            preferredTopPadding: 1,
            viewportHeight: currentScrollBox.viewport.height,
          }),
        });
      });
    }),
  );

  return (
    <box flexGrow={1} position="relative" backgroundColor={props.colors.bg}>
      <scrollbox
        id="review-stream-scroll"
        ref={(node) => {
          scrollBox = node;
          setMountedScrollBox(node);
        }}
        width="100%"
        height="100%"
        scrollY={true}
        backgroundColor={props.colors.bg}
        scrollAcceleration={scrollAcceleration}
        viewportCulling={true}
        verticalScrollbarOptions={{ visible: false }}
        horizontalScrollbarOptions={{ visible: false }}
      >
        <box flexDirection="column" paddingLeft={1} paddingRight={1}>
          <Show
            when={sections()}
            fallback={
              <text
                fg={props.colors.faint}
                bg={props.colors.bg}
                content={
                  sections.error
                    ? `Review stream unavailable: ${String(sections.error)}`
                    : "Preparing review stream…"
                }
              />
            }
          >
            {(resolved) => (
              <For each={resolved()}>
                {(section) => {
                  const selected = () => section.document.id === props.activeDocumentId;
                  const headerBackground = () =>
                    selected() ? props.colors.accentMuted : props.colors.panelAlt;
                  return (
                    <box
                      id={reviewStreamSectionId(section.document.id)}
                      flexDirection="column"
                      backgroundColor={props.colors.bg}
                    >
                      <box
                        id={reviewStreamFileId(section.document.id)}
                        height={1}
                        flexDirection="row"
                        paddingLeft={1}
                        paddingRight={1}
                        backgroundColor={headerBackground()}
                        onMouseDown={() => props.onSelectTarget(section.document.id)}
                      >
                        <text
                          fg={selected() ? props.colors.accent : props.colors.text}
                          bg={headerBackground()}
                          content={section.document.path}
                          wrapMode="none"
                        />
                        <box flexGrow={1} backgroundColor={headerBackground()} />
                        <text
                          fg={props.colors.added}
                          bg={headerBackground()}
                          content={`+${section.document.additions}`}
                          flexShrink={0}
                        />
                        <text
                          fg={props.colors.deleted}
                          bg={headerBackground()}
                          content={`  -${section.document.deletions}`}
                          flexShrink={0}
                        />
                        <text
                          fg={props.colors.faint}
                          bg={headerBackground()}
                          content={`  ${section.document.hunkCount} ${section.document.hunkCount === 1 ? "hunk" : "hunks"}`}
                          flexShrink={0}
                        />
                      </box>
                      <Show
                        when={section.plan}
                        fallback={
                          <text
                            fg={props.colors.faint}
                            bg={props.colors.bg}
                            content={
                              section.error
                                ? `Diff unavailable: ${section.error}`
                                : "Patch content was not included in this session snapshot."
                            }
                          />
                        }
                      >
                        {(plan) => (
                          <DiffView
                            plan={plan()}
                            wrap={props.wrap}
                            theme={props.theme}
                            selectedHunkId={props.selectedHunkId}
                            onSelectTarget={props.onSelectTarget}
                          />
                        )}
                      </Show>
                    </box>
                  );
                }}
              </For>
            )}
          </Show>
        </box>
      </scrollbox>
      <Show when={mountedScrollBox()}>
        {(currentScrollBox) => (
          <VerticalScrollbar
            scrollBox={currentScrollBox()}
            metrics={scrollMetrics()}
            activityId={scrollbarActivityId()}
            colors={props.colors}
          />
        )}
      </Show>
    </box>
  );
}
