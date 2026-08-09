import type { ScrollBoxRenderable, MouseEvent as TuiMouseEvent } from "@opentui/core";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { ShellColors } from "./theme";

const HIDE_DELAY_MS = 2_000;
const MIN_THUMB_HEIGHT = 2;

interface ScrollMetrics {
  scrollTop: number;
  viewportHeight: number;
  contentHeight: number;
}

interface VerticalScrollbarProps {
  scrollBox: ScrollBoxRenderable;
  metrics: ScrollMetrics;
  activityId: number;
  colors: ShellColors;
}

/** Solid adaptation of Hunk's auto-hiding, draggable one-column review scrollbar. */
export function VerticalScrollbar(props: VerticalScrollbarProps) {
  const [visible, setVisible] = createSignal(false);
  let containerTop = 0;
  const [dragging, setDragging] = createSignal(false);
  let isDragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;

  const show = () => {
    setVisible(true);
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      hideTimeout = undefined;
      if (!isDragging) setVisible(false);
    }, HIDE_DELAY_MS);
  };

  createEffect(() => {
    if (props.activityId > 0) show();
  });
  onCleanup(() => {
    if (hideTimeout) clearTimeout(hideTimeout);
  });

  const trackHeight = () => Math.max(0, props.metrics.viewportHeight);
  const maxScroll = () => Math.max(0, props.metrics.contentHeight - trackHeight());
  const thumbHeight = () =>
    Math.min(
      trackHeight(),
      Math.max(
        MIN_THUMB_HEIGHT,
        Math.floor(trackHeight() * (trackHeight() / Math.max(1, props.metrics.contentHeight))),
      ),
    );
  const maxThumbY = () => Math.max(0, trackHeight() - thumbHeight());
  const thumbY = () =>
    Math.floor((maxScroll() > 0 ? props.metrics.scrollTop / maxScroll() : 0) * maxThumbY());
  const shouldShow = () =>
    visible() && trackHeight() > 0 && props.metrics.contentHeight > trackHeight();

  const handleMouseDown = (event: TuiMouseEvent) => {
    if (event.button !== 0) return;
    isDragging = true;
    setDragging(true);
    dragStartY = event.y;
    dragStartScroll = props.scrollBox.scrollTop;
    show();
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseDrag = (event: TuiMouseEvent) => {
    if (!isDragging) return;
    const pixelsPerRow = maxThumbY() > 0 && maxScroll() > 0 ? maxThumbY() / maxScroll() : 1;
    const nextScrollTop = Math.max(
      0,
      Math.min(maxScroll(), dragStartScroll + (event.y - dragStartY) / pixelsPerRow),
    );
    props.scrollBox.scrollTo(nextScrollTop);
    show();
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseUp = (event?: TuiMouseEvent) => {
    if (!isDragging) return;
    isDragging = false;
    setDragging(false);
    show();
    event?.preventDefault();
    event?.stopPropagation();
  };

  const handleTrackClick = (event: TuiMouseEvent) => {
    if (event.button !== 0) return;
    const clickY = event.y - (event.currentTarget?.y ?? containerTop);
    if (clickY < thumbY()) {
      props.scrollBox.scrollTo(Math.max(0, props.metrics.scrollTop - trackHeight()));
    } else if (clickY >= thumbY() + thumbHeight()) {
      props.scrollBox.scrollTo(Math.min(maxScroll(), props.metrics.scrollTop + trackHeight()));
    }
    show();
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Show when={shouldShow()}>
      <box
        id="review-stream-scrollbar"
        ref={(node) => {
          containerTop = node.y;
        }}
        position="absolute"
        top={0}
        right={0}
        width={1}
        height={trackHeight()}
        backgroundColor={props.colors.panel}
        zIndex={2}
      >
        <box
          id="review-stream-scrollbar-track"
          position="absolute"
          top={0}
          left={0}
          width={1}
          height={trackHeight()}
          backgroundColor={props.colors.border}
          onMouseDown={handleTrackClick}
        />
        <box
          id="review-stream-scrollbar-thumb"
          position="absolute"
          top={thumbY()}
          left={0}
          width={1}
          height={thumbHeight()}
          backgroundColor={dragging() ? props.colors.accent : props.colors.accentMuted}
          onMouseDown={handleMouseDown}
          onMouseDrag={handleMouseDrag}
          onMouseUp={handleMouseUp}
          onMouseDragEnd={handleMouseUp}
        />
      </box>
    </Show>
  );
}
