import { useMemo } from "react";

interface StoreThemeColors {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font?: string;
}

interface StoreThemeProviderProps {
  colors: StoreThemeColors;
  children: React.ReactNode;
}

/**
 * Converts a hex color to HSL string (without "hsl()" wrapper) for CSS variable usage.
 */
function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getLuminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g)?.map(c => parseInt(c, 16) / 255) || [0, 0, 0];
  const [r, g, b] = rgb.map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastColor(bgHex: string): string {
  return getLuminance(bgHex) > 0.5 ? '#1a1a1a' : '#ffffff';
}

function adjustBrightness(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const FONT_MAP: Record<string, string> = {
  'Tajawal': "'Tajawal', sans-serif",
  'Cairo': "'Cairo', sans-serif",
  'Almarai': "'Almarai', sans-serif",
  'Noto Kufi Arabic': "'Noto Kufi Arabic', sans-serif",
  'IBM Plex Sans Arabic': "'IBM Plex Sans Arabic', sans-serif",
  'Readex Pro': "'Readex Pro', sans-serif",
};

/**
 * Wraps children in a themed container that applies store-specific colors as CSS variables.
 * This creates an isolated theme scope without affecting the admin dashboard.
 */
const StoreThemeProvider = ({ colors, children }: StoreThemeProviderProps) => {
  const style = useMemo(() => {
    const bg = colors.backgroundColor || '#ffffff';
    const text = colors.textColor || '#333333';
    const accent = colors.accentColor || '#6366f1';
    const font = colors.font || 'Tajawal';
    const isDarkBg = getLuminance(bg) < 0.5;
    const mutedBg = isDarkBg ? adjustBrightness(bg, 20) : adjustBrightness(bg, -10);
    const borderColor = isDarkBg ? adjustBrightness(bg, 30) : adjustBrightness(bg, -20);
    const mutedText = isDarkBg ? adjustBrightness(text, -60) : adjustBrightness(text, 60);
    const cardBg = isDarkBg ? adjustBrightness(bg, 10) : '#ffffff';
    const accentFg = getContrastColor(accent);

    return {
      '--background': hexToHSL(bg),
      '--foreground': hexToHSL(text),
      '--card': hexToHSL(cardBg),
      '--card-foreground': hexToHSL(text),
      '--primary': hexToHSL(accent),
      '--primary-foreground': hexToHSL(accentFg),
      '--secondary': hexToHSL(mutedBg),
      '--secondary-foreground': hexToHSL(text),
      '--muted': hexToHSL(mutedBg),
      '--muted-foreground': hexToHSL(mutedText),
      '--accent': hexToHSL(mutedBg),
      '--accent-foreground': hexToHSL(accent),
      '--border': hexToHSL(borderColor),
      '--input': hexToHSL(borderColor),
      '--ring': hexToHSL(accent),
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 100%',
      fontFamily: FONT_MAP[font] || FONT_MAP['Tajawal'],
    } as React.CSSProperties;
  }, [colors.backgroundColor, colors.textColor, colors.accentColor, colors.font]);

  return (
    <div style={style} className="store-theme-scope">
      {children}
    </div>
  );
};

export default StoreThemeProvider;
