import { type MouseEvent, TextAttributes } from "@opentui/core";
import type { ReviewDocument } from "@victor-software-house/reviewbench-protocol";
import { createSignal, For, Show } from "solid-js";
import type { ShellColors } from "./theme";

export interface TabsProps {
  tabs: ReviewDocument[];
  activeId: string | null;
  colors: ShellColors;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

/** Druk-derived one-row document tabs; review workspaces remain outside this strip. */
export function Tabs(props: TabsProps) {
  const [hoveredId, setHoveredId] = createSignal<string | null>(null);

  return (
    <box height={1} flexDirection="row" flexShrink={0} backgroundColor={props.colors.bar}>
      <Show
        when={props.tabs.length > 0}
        fallback={<text fg={props.colors.faint} bg={props.colors.bar} content="  no documents" />}
      >
        <For each={props.tabs}>
          {(tab) => {
            const active = () => tab.id === props.activeId;
            const hovered = () => tab.id === hoveredId();
            const background = () =>
              active()
                ? props.colors.panelAlt
                : hovered()
                  ? props.colors.accentMuted
                  : props.colors.bar;
            return (
              // biome-ignore lint/a11y/useKeyWithMouseEvents: OpenTUI BoxProps has no focus/blur API; remove when upstream exposes one.
              <box
                flexDirection="row"
                flexShrink={0}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={background()}
                onMouseMove={() => setHoveredId(tab.id)}
                onMouseOut={() => setHoveredId((id) => (id === tab.id ? null : id))}
                onMouseDown={() => props.onSelect(tab.id)}
              >
                <text
                  fg={active() ? props.colors.accent : props.colors.faint}
                  bg={background()}
                  content={active() ? "● " : "  "}
                />
                <text
                  fg={active() || hovered() ? props.colors.text : props.colors.dim}
                  bg={background()}
                  content={tab.path}
                  wrapMode="none"
                  attributes={active() ? TextAttributes.BOLD : TextAttributes.NONE}
                />
                <Show when={props.tabs.length > 1}>
                  <text
                    fg={active() || hovered() ? props.colors.dim : props.colors.faint}
                    bg={background()}
                    content="  ×"
                    onMouseDown={(event: MouseEvent) => {
                      event.stopPropagation();
                      props.onClose(tab.id);
                    }}
                  />
                </Show>
              </box>
            );
          }}
        </For>
      </Show>
      <box flexGrow={1} backgroundColor={props.colors.bar} />
    </box>
  );
}
