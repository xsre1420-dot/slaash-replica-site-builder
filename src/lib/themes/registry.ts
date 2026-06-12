export interface StoreTheme {
  id: string;
  name: string;
  description: string;
  defaults: {
    menuBackgroundColor: string;
    menuTextColor: string;
    menuAccentColor: string;
    storeFont: string;
  };
}

/** Phase 10: Theme registry — owners pick a theme, then customize colors/fonts */
export const STORE_THEMES: StoreTheme[] = [
  {
    id: 'default',
    name: 'كلاسيكي',
    description: 'تصميم نظيف ومتعدد الاستخدامات',
    defaults: {
      menuBackgroundColor: '#ffffff',
      menuTextColor: '#333333',
      menuAccentColor: '#6366f1',
      storeFont: 'Tajawal',
    },
  },
  {
    id: 'minimal',
    name: 'بسيط',
    description: 'أبيض وأسود مع خط أنيق',
    defaults: {
      menuBackgroundColor: '#fafafa',
      menuTextColor: '#111111',
      menuAccentColor: '#000000',
      storeFont: 'Cairo',
    },
  },
  {
    id: 'vibrant',
    name: 'حيوي',
    description: 'ألوان جريئة للمتاجر الشبابية',
    defaults: {
      menuBackgroundColor: '#1e1b4b',
      menuTextColor: '#f8fafc',
      menuAccentColor: '#f59e0b',
      storeFont: 'Tajawal',
    },
  },
  {
    id: 'nature',
    name: 'طبيعي',
    description: 'أخضر هادئ للمنتجات العضوية',
    defaults: {
      menuBackgroundColor: '#f0fdf4',
      menuTextColor: '#14532d',
      menuAccentColor: '#16a34a',
      storeFont: 'Tajawal',
    },
  },
];

export const getThemeById = (id: string): StoreTheme =>
  STORE_THEMES.find((t) => t.id === id) ?? STORE_THEMES[0];

export const applyThemeDefaults = (themeId: string) => getThemeById(themeId).defaults;
