export type LeadStatus = 'new' | 'contacted' | 'interested' | 'customer' | 'rejected';

export type LeadRecord = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  status: LeadStatus;
  source: string;
  notes: string | null;
  selected_plan_id: string | null;
  selected_plan_name: string | null;
  governorate: string | null;
  instagram_url: string | null;
  expected_monthly_orders: string | null;
  admin_read_at: string | null;
  converted_user_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  is_unread?: boolean;
  has_pending_code?: boolean;
};

export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export type SubscriptionRecord = {
  id: string;
  user_id: string;
  plan_name: string;
  start_date: string;
  end_date: string | null;
  status: SubscriptionStatus;
  lead_id: string | null;
  converted_at: string | null;
  notes: string | null;
  created_at: string;
  username?: string | null;
  store_name?: string | null;
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  interested: 'مهتم',
  customer: 'عميل',
  rejected: 'مرفوض',
};

export const LEAD_STATUS_OPTIONS: LeadStatus[] = [
  'new',
  'contacted',
  'interested',
  'customer',
  'rejected',
];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'نشط',
  expired: 'منتهي',
  suspended: 'موقوف',
};

export const buildWhatsAppUrl = (phone: string, message?: string): string => {
  const digits = phone.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
};
