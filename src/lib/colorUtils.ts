import type { ColorPalette } from "./types";

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const v = Math.round(c * 255);
    return v.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const SHADE_LIGHTNESS: Record<string, number> = {
  "50": 97,
  "100": 94,
  "200": 86,
  "300": 74,
  "400": 60,
  "500": 48,
  "600": 40,
  "700": 33,
  "800": 26,
  "900": 20,
  "950": 10,
};

export function generatePalette(baseHex: string): ColorPalette {
  const { h, s } = hexToHsl(baseHex);
  const palette: ColorPalette = {};

  for (const [shade, targetL] of Object.entries(SHADE_LIGHTNESS)) {
    // Scale saturation: lighter shades reduce saturation, darker shades boost it
    const normalizedL = targetL / 100;
    let adjustedS: number;
    if (normalizedL > 0.5) {
      // Lighter shades: reduce saturation up to 15%
      const factor = (normalizedL - 0.5) / 0.5;
      adjustedS = s * (1 - factor * 0.15);
    } else {
      // Darker shades: boost saturation up to 10%
      const factor = (0.5 - normalizedL) / 0.5;
      adjustedS = s * (1 + factor * 0.1);
    }
    adjustedS = Math.min(100, Math.max(0, adjustedS));

    palette[shade] = hslToHex(h, adjustedS, targetL);
  }

  return palette;
}
