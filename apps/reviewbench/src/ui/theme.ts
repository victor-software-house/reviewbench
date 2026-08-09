export interface ShellColors {
  bg: string;
  panel: string;
  panelAlt: string;
  bar: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  accentMuted: string;
  selected: string;
  added: string;
  deleted: string;
  warning: string;
}

const themes: Record<"dark" | "light", ShellColors> = {
  dark: {
    bg: "#0d1117",
    panel: "#11161d",
    panelAlt: "#161b22",
    bar: "#161b22",
    text: "#e6edf3",
    dim: "#8b949e",
    faint: "#6e7681",
    accent: "#58a6ff",
    accentMuted: "#1a2635",
    selected: "#1a2635",
    added: "#56d364",
    deleted: "#ff7b72",
    warning: "#e3b341",
  },
  light: {
    bg: "#ffffff",
    panel: "#f6f8fa",
    panelAlt: "#eaeef2",
    bar: "#eaeef2",
    text: "#1f2328",
    dim: "#656d76",
    faint: "#8c959f",
    accent: "#0969da",
    accentMuted: "#ddf4ff",
    selected: "#ddf4ff",
    added: "#1a7f37",
    deleted: "#cf222e",
    warning: "#9a6700",
  },
};

/** GitHub-derived surfaces kept in lockstep with the matching Shiki diff palettes. */
export function colorsFor(theme: "dark" | "light") {
  return themes[theme];
}
