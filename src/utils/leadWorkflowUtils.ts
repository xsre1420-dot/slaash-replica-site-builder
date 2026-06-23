import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { LeadRecord, LeadStatus } from '@/types/leads';
import { getMonthlyOrderLabel } from '@/data/leadFormOptions';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';

export type LeadQuickFilter =  | 'all'
  | 'unread'
  | 'needs_code'
  | 'pending_activation'
  | 'pipeline'
  | 'today'
  | 'customers';

export type LeadFilterStats = {
  total: number;
  new_count: number;
  unread_count: number;
  needs_code_count: number;
  pending_activation_count: number;
  pipeline_count: number;
  customer_count: number;
  today_count: number;
};

type StatKey = keyof LeadFilterStats;

export type LeadFilterDefinition = {
  id: LeadQuickFilter;
  label: string;
  statKey: StatKey;
  description: string;
  emptyMessage: string;
  group: 'workflow' | 'overview';
  accentBg: string;
  accentText: string;
};

export const LEAD_FILTER_DEFINITIONS: LeadFilterDefinition[] = [
  {
    id: 'unread',
    label: 'غير مقروء',
    statKey: 'unread_count',
    description: 'طلبات جديدة لم تُراجع بعد — تحتاج ردّاً سريعاً',
    emptyMessage: 'لا طلبات غير مقروءة — ممتاز!',
    group: 'workflow',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-600',
  },
  {
    id: 'needs_code',
    label: 'يحتاج رمز',
    statKey: 'needs_code_count',
    description: 'تم التواصل ولم يُنشأ رمز تفعيل بعد',
    emptyMessage: 'لا طلبات تحتاج رمزاً الآن',
    group: 'workflow',
    accentBg: 'bg-violet-500/10',
    accentText: 'text-violet-600',
  },
  {
    id: 'pending_activation',
    label: 'بانتظار التفعيل',
    statKey: 'pending_activation_count',
    description: 'الرمز مُرسَل — بانتظار دخول العميل',
    emptyMessage: 'لا عملاء بانتظار التفعيل',
    group: 'workflow',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-600',
  },
  {
    id: 'pipeline',
    label: 'قيد المعالجة',
    statKey: 'pipeline_count',
    description: 'كل الطلبات النشطة في مسار المبيعات',
    emptyMessage: 'لا طلبات قيد المعالجة',
    group: 'workflow',
    accentBg: 'bg-indigo-500/10',
    accentText: 'text-indigo-600',
  },
  {
    id: 'today',
    label: 'طلبات اليوم',
    statKey: 'today_count',
    description: 'طلبات وردت اليوم (توقيت بغداد)',
    emptyMessage: 'لا طلبات جديدة اليوم',
    group: 'overview',
    accentBg: 'bg-primary/10',
    accentText: 'text-primary',
  },
  {
    id: 'customers',
    label: 'عملاء مُفعّلون',
    statKey: 'customer_count',
    description: 'عملاء أكّدوا الاشتراك وفعّلوا حسابهم',
    emptyMessage: 'لا عملاء مُفعّلين بعد',
    group: 'overview',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-600',
  },
];

/** @deprecated use LEAD_FILTER_DEFINITIONS */
export const LEAD_QUICK_FILTERS = LEAD_FILTER_DEFINITIONS.filter((d) => d.group === 'workflow').map(
  (d) => ({ id: d.id, label: d.label })
);

export const getLeadFilterEmptyMessage = (filter: LeadQuickFilter): string => {
  if (filter === 'all') return 'لا توجد طلبات';
  return LEAD_FILTER_DEFINITIONS.find((d) => d.id === filter)?.emptyMessage ?? 'لا توجد طلبات';
};

export const matchesLeadQuickFilter = (lead: LeadRecord, filter: LeadQuickFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'unread') return Boolean(lead.is_unread);
  if (filter === 'needs_code') {
    return (
      !lead.converted_user_id &&
      lead.status !== 'rejected' &&
      !lead.has_pending_code
    );
  }
  if (filter === 'pending_activation') {
    return !lead.converted_user_id && Boolean(lead.has_pending_code);
  }
  if (filter === 'pipeline') {
    return lead.status === 'new' || lead.status === 'contacted' || lead.status === 'interested';
  }
  if (filter === 'customers') {
    return Boolean(lead.converted_user_id) || lead.status === 'customer';
  }
  if (filter === 'today') {
    try {
      const created = new Date(lead.created_at);
      const now = new Date();
      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate()
      );
    } catch {
      return false;
    }
  }
  return true;
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  contacted: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
  interested: 'bg-violet-500/10 text-violet-800 border-violet-500/20',
  customer: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20',
  rejected: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

export const formatLeadRelativeTime = (iso: string): string => {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ar });
  } catch {
    return '—';
  }
};

export const buildInitialWhatsAppMessage = (lead: LeadRecord): string => {
  const plan =
    lead.selected_plan_name ||
    PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === lead.selected_plan_id)?.name ||
    'باقة النخبة';
  const orders = lead.expected_monthly_orders
    ? getMonthlyOrderLabel(lead.expected_monthly_orders)
    : null;

  let msg =
    `مرحباً ${lead.full_name} 👋\n\n` +
    `معك فريق *بداية* — استلمنا طلب اشتراكك في المنصة.\n` +
    `الباقة المختارة: *${plan}*`;

  if (lead.governorate) {
    msg += `\nالمحافظة: ${lead.governorate}`;
  }
  if (orders) {
    msg += `\nحجم الطلبات المتوقع: ${orders}`;
  }

  msg +=
    `\n\nهل الوقت مناسب للاتفاق على التفاصيل وتفعيل متجرك؟`;

  return msg;
};

export const buildFollowUpWhatsAppMessage = (lead: LeadRecord): string =>
  `مرحباً ${lead.full_name}،\n\n` +
  `تابعنا معك بخصوص اشتراك *بداية*. هل ما زلت مهتمّاً بفتح متجرك الإلكتروني؟\n\n` +
  `ردّ بـ «نعم» وسنكمل خطوة التفعيل فوراً.`;

export const buildLeadSummaryText = (lead: LeadRecord): string => {
  const lines = [
    `الاسم: ${lead.full_name}`,
    `واتساب: ${lead.whatsapp_number}`,
    lead.selected_plan_name ? `الباقة: ${lead.selected_plan_name}` : null,
    lead.governorate ? `المحافظة: ${lead.governorate}` : null,
    lead.expected_monthly_orders
      ? `الطلبات: ${getMonthlyOrderLabel(lead.expected_monthly_orders)}`
      : null,
    lead.instagram_url ? `إنستغرام: ${lead.instagram_url}` : null,
    `الحالة: ${lead.status}`,
  ].filter(Boolean);
  return lines.join('\n');
};

export const getLeadPriorityLabel = (lead: LeadRecord): string | null => {
  if (lead.converted_user_id) return null;
  if (lead.has_pending_code) return 'بانتظار التفعيل';
  if (lead.status === 'new' && lead.is_unread) return 'جديد — رد سريع';
  if (lead.status === 'new' || lead.status === 'contacted') return 'يحتاج رمز';
  return null;
};
