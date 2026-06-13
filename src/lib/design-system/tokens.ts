/**
 * Design tokens — primary brand #6366f1 (indigo-500)
 */
export const brand = {
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primaryLight: '#eef2ff',
  primaryMuted: 'hsl(239 84% 67% / 0.12)',
} as const;

export const typography = {
  fontArabic: "'Tajawal', sans-serif",
  fontEnglish: "'Inter', 'Plus Jakarta Sans', sans-serif",
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
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  page: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  section: 'space-y-6 lg:space-y-8',
  card: 'p-5 sm:p-6 lg:p-8',
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
  md: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 4px 16px -2px rgb(99 102 241 / 0.12)',
  lg: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 16px 40px -4px rgb(99 102 241 / 0.15)',
} as const;

export const navGroups = {
  main: { label: 'الرئيسية' },
  manage: { label: 'الإدارة' },
  account: { label: 'الحساب' },
} as const;
