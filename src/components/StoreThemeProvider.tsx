import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  buildStoreThemePalette,
  paletteToCssVars,
  STORE_FONT_MAP,
  getLuminance,
} from '@/lib/storeThemeUtils';

interface StoreThemeColors {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font?: string;
}

interface StoreThemeProviderProps {
  colors: StoreThemeColors;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps children in a themed container that applies store-specific colors as CSS variables.
 * This creates an isolated theme scope without affecting the admin dashboard.
 */
const StoreThemeProvider = ({ colors, children, className }: StoreThemeProviderProps) => {
  const style = useMemo(() => {
    const bg = colors.backgroundColor || '#ffffff';
    const font = colors.font || 'Tajawal';
    const palette = buildStoreThemePalette(
      colors.backgroundColor,
      colors.textColor,
      colors.accentColor
    );

    return {
      ...paletteToCssVars(palette),
      fontFamily: STORE_FONT_MAP[font] || STORE_FONT_MAP.Tajawal,
      colorScheme: getLuminance(bg) < 0.5 ? 'dark' : 'light',
    } as React.CSSProperties;
  }, [colors.backgroundColor, colors.textColor, colors.accentColor, colors.font]);

  return (
    <div style={style} className={cn('store-theme-scope w-full', className)}>
      {children}
    </div>
  );
};

export default StoreThemeProvider;
