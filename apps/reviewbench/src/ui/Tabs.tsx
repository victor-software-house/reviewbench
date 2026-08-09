import { type MouseEvent, TextAttributes } from "@opentui/core";
import type { ReviewDocument } from "@victor-software-house/reviewbench-protocol";
import { For, Show } from "solid-js";
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
  return (
    <box height={1} flexDirection="row" flexShrink={0} backgroundColor={props.colors.bar}>
      <Show
        when={props.tabs.length > 0}
        fallback={<text fg={props.colors.faint} bg={props.colors.bar} content="  no documents" />}
      >
        <For each={props.tabs}>
          {(tab) => {
            const active = () => tab.id === props.activeId;
            const background = () => (active() ? props.colors.bg : props.colors.bar);
            return (
              <box
                flexDirection="row"
                flexShrink={0}
                paddingRight={1}
                backgroundColor={background()}
                onMouseDown={() => props.onSelect(tab.id)}
              >
                <text fg={props.colors.accent} bg={background()} content={active() ? "▎" : " "} />
                <text
                  fg={active() ? props.colors.text : props.colors.dim}
                  bg={background()}
                  content={tab.path}
                  wrapMode="none"
                  attributes={active() ? TextAttributes.BOLD : TextAttributes.NONE}
                />
                <text
                  fg={props.colors.faint}
                  bg={background()}
                  content=" ×"
                  onMouseDown={(event: MouseEvent) => {
                    event.stopPropagation();
                    props.onClose(tab.id);
                  }}
                />
              </box>
            );
          }}
        </For>
      </Show>
      <box flexGrow={1} backgroundColor={props.colors.bar} />
    </box>
  );
}
