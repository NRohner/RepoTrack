import type { ColorTheme } from "./types";

export const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

export function applyColorTheme(theme: ColorTheme): void {
  const root = document.documentElement;
  for (const shade of SHADES) {
    if (theme.accent_palette[shade]) {
      root.style.setProperty(`--accent-${shade}`, theme.accent_palette[shade]);
    }
    if (theme.surface_palette[shade]) {
      root.style.setProperty(`--surface-${shade}`, theme.surface_palette[shade]);
    }
  }
}

export function resetColorTheme(): void {
  const root = document.documentElement;
  for (const shade of SHADES) {
    root.style.removeProperty(`--accent-${shade}`);
    root.style.removeProperty(`--surface-${shade}`);
  }
}
