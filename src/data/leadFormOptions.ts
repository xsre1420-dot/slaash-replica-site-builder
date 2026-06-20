export const IRAQ_GOVERNORATES = [
  'بغداد',
  'نينوى (الموصل)',
  'البصرة',
  'الأنبار',
  'ذي قار (الناصرية)',
  'السليمانية',
  'أربيل',
  'دهوك',
  'كركوك',
  'ديالى',
  'صلاح الدين',
  'واسط (الكوت)',
  'بابل (الحلة)',
  'النجف',
  'كربلاء',
  'المثنى (السماوة)',
  'ميسان (العمارة)',
  'القادسية (الديوانية)',
] as const;

export const MONTHLY_ORDER_OPTIONS = [
  { value: 'not_started', label: 'لم أبدأ البيع بعد' },
  { value: 'under_50', label: 'أقل من 50 طلب شهرياً' },
  { value: '50_200', label: '50 – 200 طلب شهرياً' },
  { value: '200_500', label: '200 – 500 طلب شهرياً' },
  { value: '500_1000', label: '500 – 1,000 طلب شهرياً' },
  { value: 'over_1000', label: 'أكثر من 1,000 طلب شهرياً' },
] as const;

export const getMonthlyOrderLabel = (value: string | null | undefined): string =>
  MONTHLY_ORDER_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '—';
