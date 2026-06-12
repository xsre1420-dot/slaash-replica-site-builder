/**
 * Design tokens — primary brand #6366f1 (indigo-500)
 * HSL: 239 84% 67% ≈ used as 248 53% 58% in CSS for softer SaaS feel
 */
export const brand = {
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primaryLight: '#eef2ff',
  primaryMuted: 'hsl(248 53% 58% / 0.12)',
} as const;

export const typography = {
  fontArabic: "'Tajawal', sans-serif",
  fontEnglish: "'Inter', sans-serif",
  sizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const spacing = {
  page: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  section: 'space-y-6',
  card: 'p-5 sm:p-6',
} as const;

export const radius = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
} as const;

export const touchTarget = 'min-h-[44px] min-w-[44px]';

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  md: '0 4px 12px -2px rgb(99 102 241 / 0.08)',
  lg: '0 12px 32px -4px rgb(99 102 241 / 0.12)',
} as const;
