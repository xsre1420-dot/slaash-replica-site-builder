export type PublicSubscriptionPlan = {
  id: string;
  name: string;
  priceAmount: number;
  intervalMonths: number;
  billingLabel: string;
  toggleLabel: string;
  priceSuffix: string;
  description: string;
  highlight?: string;
  features: string[];
};

export const ELITE_PLAN_NAME = 'باقة النخبة';
export const ELITE_PLAN_BADGE = 'الباقة المميزة';

export const ELITE_FEATURES = [
  'طلبات غير محدودة',
  'منتجات وأصناف بدون قيود',
  'لوحة تحكم وتحليلات متقدّمة',
  'إدارة الطلبات من مكان واحد',
  'دعم فني بأولوية',
  'حماية SSL لمتجرك وعملائك',
  'تخصيص كامل لهوية متجرك',
  'دومين مخصص لعلامتك التجارية',
];

/** Public billing options: 6 months + 1 year only */
export const PUBLIC_SUBSCRIPTION_PLANS: PublicSubscriptionPlan[] = [
  {
    id: 'annual',
    name: ELITE_PLAN_NAME,
    priceAmount: 125_000,
    intervalMonths: 6,
    toggleLabel: '6 أشهر',
    billingLabel: '6 أشهر',
    priceSuffix: '/ 6 أشهر',
    description: 'مثالية للانطلاق السريع وبناء قاعدة عملاء قوية',
    features: ELITE_FEATURES,
  },
  {
    id: 'yearly',
    name: ELITE_PLAN_NAME,
    priceAmount: 220_000,
    intervalMonths: 12,
    toggleLabel: 'سنة',
    billingLabel: 'سنوياً',
    priceSuffix: '/ سنة',
    description: 'الخيار الأوفر — التزام سنوي بسعر أقل',
    highlight: 'وفّر ٣٠ ألف د.ع',
    features: ELITE_FEATURES,
  },
];

export const getPublicPlanById = (planId: string | null | undefined): PublicSubscriptionPlan | undefined =>
  PUBLIC_SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);

export const formatPlanPrice = (amount: number): string =>
  `${amount.toLocaleString('ar-IQ')} د.ع`;

/** e.g. 125 → "125" + " ألف د.ع / 6 أشهر" */
export const formatPlanPriceHero = (plan: PublicSubscriptionPlan): { main: string; suffix: string } => {
  const thousands = plan.priceAmount / 1000;
  const main = Number.isInteger(thousands)
    ? thousands.toLocaleString('ar-IQ')
    : thousands.toLocaleString('ar-IQ', { maximumFractionDigits: 1 });
  return { main, suffix: ` ألف د.ع ${plan.priceSuffix}` };
};

export const formatPlanPriceLabel = (plan: PublicSubscriptionPlan): string => {
  const { main, suffix } = formatPlanPriceHero(plan);
  return `${main}${suffix}`;
};

export const getPlanIndex = (planId: string): number =>
  PUBLIC_SUBSCRIPTION_PLANS.findIndex((p) => p.id === planId);
