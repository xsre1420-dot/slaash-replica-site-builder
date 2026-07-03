/** Shared color utilities for storefront theming */

export function hexToHSL(hex: string): string {
  let r = 0;
  let g = 0;
  let b = 0;
  const normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else {
    r = parseInt(normalized.substring(0, 2), 16);
    g = parseInt(normalized.substring(2, 4), 16);
    b = parseInt(normalized.substring(4, 6), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function getLuminance(hex: string): number {
  const rgb =
    hex
      .replace('#', '')
      .match(/.{2}/g)
      ?.map((c) => parseInt(c, 16) / 255) || [0, 0, 0];
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastColor(bgHex: string): string {
  return getLuminance(bgHex) > 0.5 ? '#1a1a1a' : '#ffffff';
}

export function adjustBrightness(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Blend two hex colors; `ratio` is weight of color `a` (0–1). */
export function mixHex(a: string, b: string, ratio: number): string {
  const clamp = Math.max(0, Math.min(1, ratio));
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar * clamp + br * (1 - clamp));
  const g = Math.round(ag * clamp + bg * (1 - clamp));
  const bl = Math.round(ab * clamp + bb * (1 - clamp));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export interface StoreThemePalette {
  background: string;
  foreground: string;
  accent: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accentSoft: string;
  accentMuted: string;
}

export function buildStoreThemePalette(
  backgroundColor: string,
  textColor: string,
  accentColor: string
): StoreThemePalette {
  const bg = backgroundColor || '#ffffff';
  const text = textColor || '#333333';
  const accent = accentColor || '#6366f1';
  const isDarkBg = getLuminance(bg) < 0.5;

  const muted = isDarkBg ? adjustBrightness(bg, 18) : mixHex(bg, text, 0.06);
  const borderColor = isDarkBg ? adjustBrightness(bg, 28) : mixHex(bg, text, 0.12);
  const mutedText = isDarkBg ? adjustBrightness(text, -50) : mixHex(text, bg, 0.45);
  const card = isDarkBg ? adjustBrightness(bg, 10) : mixHex(bg, '#ffffff', 0.72);
  const accentSoft = isDarkBg ? mixHex(accent, bg, 0.22) : mixHex(accent, bg, 0.1);
  const accentMuted = isDarkBg ? mixHex(accent, bg, 0.14) : mixHex(accent, bg, 0.06);

  return {
    background: bg,
    foreground: text,
    accent,
    card,
    muted,
    mutedForeground: mutedText,
    border: borderColor,
    accentSoft,
    accentMuted,
  };
}

export function paletteToCssVars(palette: StoreThemePalette): Record<string, string> {
  const accentFg = getContrastColor(palette.accent);

  return {
    '--background': hexToHSL(palette.background),
    '--foreground': hexToHSL(palette.foreground),
    '--card': hexToHSL(palette.card),
    '--card-foreground': hexToHSL(palette.foreground),
    '--primary': hexToHSL(palette.accent),
    '--primary-foreground': hexToHSL(accentFg),
    '--secondary': hexToHSL(palette.muted),
    '--secondary-foreground': hexToHSL(palette.foreground),
    '--muted': hexToHSL(palette.muted),
    '--muted-foreground': hexToHSL(palette.mutedForeground),
    '--accent': hexToHSL(palette.accentSoft),
    '--accent-foreground': hexToHSL(palette.accent),
    '--border': hexToHSL(palette.border),
    '--input': hexToHSL(palette.border),
    '--ring': hexToHSL(palette.accent),
    '--store-accent-soft': hexToHSL(palette.accentSoft),
    '--store-accent-muted': hexToHSL(palette.accentMuted),
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '0 0% 100%',
  } as React.CSSProperties;
}

export const STORE_FONT_MAP: Record<string, string> = {
  Tajawal: "'Tajawal', sans-serif",
  Cairo: "'Cairo', sans-serif",
  Almarai: "'Almarai', sans-serif",
  'Noto Kufi Arabic': "'Noto Kufi Arabic', sans-serif",
  'IBM Plex Sans Arabic': "'IBM Plex Sans Arabic', sans-serif",
  'Readex Pro': "'Readex Pro', sans-serif",
};
