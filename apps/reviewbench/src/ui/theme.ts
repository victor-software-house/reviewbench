export interface ShellColors {
  bg: string;
  panel: string;
  bar: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  selected: string;
  added: string;
  deleted: string;
  warning: string;
}

const themes: Record<"dark" | "light", ShellColors> = {
  dark: {
    bg: "#0d1117",
    panel: "#161b22",
    bar: "#010409",
    text: "#e6edf3",
    dim: "#8b949e",
    faint: "#6e7681",
    accent: "#58a6ff",
    selected: "#193356",
    added: "#3fb950",
    deleted: "#f85149",
    warning: "#d29922",
  },
  light: {
    bg: "#ffffff",
    panel: "#f6f8fa",
    bar: "#eaeef2",
    text: "#1f2328",
    dim: "#656d76",
    faint: "#8c959f",
    accent: "#0969da",
    selected: "#ddf4ff",
    added: "#1a7f37",
    deleted: "#cf222e",
    warning: "#9a6700",
  },
};

/** GitHub-derived Druk shell palettes, selected once by the process-global settings store. */
export function colorsFor(theme: "dark" | "light") {
  return themes[theme];
}
