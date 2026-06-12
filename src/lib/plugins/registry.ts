export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  category: 'payment' | 'marketing' | 'analytics' | 'shipping';
  version: string;
  /** Whether plugin is built-in (no external API key needed) */
  builtIn?: boolean;
}

/** Phase 11: Plugin marketplace registry */
export const PLUGIN_REGISTRY: PluginDefinition[] = [
  {
    id: 'cash_on_delivery',
    name: 'الدفع عند الاستلام',
    description: 'قبول الطلبات مع الدفع عند التوصيل',
    category: 'payment',
    version: '1.0.0',
    builtIn: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'بوابة دفع بالبطاقات الائتمانية',
    category: 'payment',
    version: '1.0.0',
  },
  {
    id: 'meta_pixel',
    name: 'Meta Pixel',
    description: 'تتبع التحويلات على فيسبوك وإنستغرام',
    category: 'analytics',
    version: '1.0.0',
    builtIn: true,
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'تحليلات زوار المتجر',
    category: 'analytics',
    version: '1.0.0',
  },
  {
    id: 'coupons',
    name: 'كوبونات الخصم',
    description: 'إنشاء وإدارة كوبونات ترويجية',
    category: 'marketing',
    version: '1.0.0',
    builtIn: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'زر تواصل مباشر عبر واتساب',
    category: 'marketing',
    version: '1.0.0',
    builtIn: true,
  },
];

export const getPlugin = (id: string): PluginDefinition | undefined =>
  PLUGIN_REGISTRY.find((p) => p.id === id);

export const getPluginsByCategory = (category: PluginDefinition['category']) =>
  PLUGIN_REGISTRY.filter((p) => p.category === category);
