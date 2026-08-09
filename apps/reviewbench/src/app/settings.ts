import { createStore } from "solid-js/store";

export type ShellThemeName = "dark" | "light";

export interface ShellSettings {
  theme: ShellThemeName;
  sidebarVisible: boolean;
  sidebarWidth: number;
  wrap: boolean;
  layout: "auto" | "split" | "stack";
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  theme: "dark",
  sidebarVisible: true,
  sidebarWidth: 24,
  wrap: true,
  layout: "auto",
};

/** Own process-global shell preferences independently from any document or review workspace. */
export function createSettings(initial: Partial<ShellSettings> = {}) {
  const [settings, setSettings] = createStore<ShellSettings>({
    ...DEFAULT_SHELL_SETTINGS,
    ...initial,
  });

  return {
    settings,
    toggleTheme: () => setSettings("theme", (theme) => (theme === "dark" ? "light" : "dark")),
    toggleSidebar: () => setSettings("sidebarVisible", (visible) => !visible),
    toggleWrap: () => setSettings("wrap", (wrap) => !wrap),
    selectLayout: (layout: ShellSettings["layout"]) => setSettings("layout", layout),
    resizeSidebar: (width: number) =>
      setSettings("sidebarWidth", Math.max(18, Math.min(40, Math.round(width)))),
  };
}

export type SettingsController = ReturnType<typeof createSettings>;
