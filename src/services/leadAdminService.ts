import { supabase } from '@/integrations/supabase/client';
import type { LeadRecord, LeadStatus } from '@/types/leads';

export class LeadSubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadSubmitError';
  }
}

export const submitAccessLead = async (input: {
  fullName: string;
  whatsappNumber: string;
  selectedPlanId: string;
  governorate: string;
  expectedMonthlyOrders: string;
  instagramUrl?: string;
  source?: string;
}): Promise<{ leadId: string }> => {
  const { data, error } = await (supabase as any).rpc('submit_access_lead', {
    p_full_name: input.fullName.trim(),
    p_whatsapp_number: input.whatsappNumber.trim(),
    p_source: input.source ?? 'website',
    p_selected_plan_id: input.selectedPlanId.trim(),
    p_governorate: input.governorate.trim(),
    p_instagram_url: input.instagramUrl?.trim() || null,
    p_expected_monthly_orders: input.expectedMonthlyOrders.trim(),
  });

  if (error) {
    const msg = error.message ?? '';
    if (/column|function|schema cache/i.test(msg)) {
      throw new LeadSubmitError(
        'قاعدة البيانات تحتاج تحديث — شغّل: npm run db:deploy'
      );
    }
    throw new LeadSubmitError(msg);
  }

  const payload = data as { success?: boolean; error?: string; lead_id?: string };
  if (!payload?.success || !payload.lead_id) {
    const code = payload?.error;
    if (code === 'invalid_name') throw new LeadSubmitError('يرجى إدخال الاسم الكامل');
    if (code === 'invalid_whatsapp') throw new LeadSubmitError('يرجى إدخال رقم واتساب صحيح');
    if (code === 'invalid_plan') throw new LeadSubmitError('يرجى اختيار باقة صحيحة');
    if (code === 'invalid_governorate') throw new LeadSubmitError('يرجى اختيار المحافظة');
    if (code === 'invalid_monthly_orders') throw new LeadSubmitError('يرجى تحديد عدد الطلبات المتوقع');
    throw new LeadSubmitError('تعذر إرسال الطلب، حاول مرة أخرى');
  }

  return { leadId: payload.lead_id };
};

export const fetchLeads = async (opts: {
  search?: string;
  status?: LeadStatus | '';
  limit?: number;
  offset?: number;
}): Promise<{ rows: LeadRecord[]; total: number }> => {
  const { data, error } = await (supabase as any).rpc('admin_list_leads', {
    p_search: opts.search || null,
    p_status: opts.status || null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });

  if (error) throw error;
  const payload = data as { success?: boolean; rows?: LeadRecord[]; total?: number; error?: string };
  if (!payload?.success) throw new Error(payload?.error || 'forbidden');
  return { rows: payload.rows ?? [], total: payload.total ?? 0 };
};

export const fetchLeadById = async (leadId: string): Promise<LeadRecord | null> => {
  const { data, error } = await (supabase as any).rpc('admin_get_lead', { p_lead_id: leadId });
  if (error) throw error;
  const payload = data as { success?: boolean; lead?: LeadRecord; error?: string };
  if (!payload?.success) return null;
  return payload.lead ?? null;
};

export const updateLead = async (
  leadId: string,
  patch: { status?: LeadStatus; notes?: string; markRead?: boolean }
): Promise<void> => {
  const { data, error } = await (supabase as any).rpc('admin_update_lead', {
    p_lead_id: leadId,
    p_status: patch.status ?? null,
    p_notes: patch.notes ?? null,
    p_mark_read: patch.markRead ?? null,
  });
  if (error) throw error;
  const payload = data as { success?: boolean; error?: string };
  if (!payload?.success) throw new Error(payload?.error || 'update_failed');
};

export const fetchUnreadLeadsCount = async (): Promise<number> => {
  const { data, error } = await (supabase as any).rpc('admin_unread_leads_count');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
};

export const fetchSubscriptions = async (opts: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  const { data, error } = await (supabase as any).rpc('admin_list_subscriptions', {
    p_search: opts.search || null,
    p_status: opts.status || null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw error;
  const payload = data as { success?: boolean; rows?: unknown[]; total?: number };
  if (!payload?.success) throw new Error('forbidden');
  return { rows: payload.rows ?? [], total: payload.total ?? 0 };
};

export const upsertSubscription = async (opts: {
  userId: string;
  planName: string;
  startDate?: string;
  endDate?: string | null;
  status?: string;
  notes?: string;
}) => {
  const { data, error } = await (supabase as any).rpc('admin_upsert_subscription', {
    p_user_id: opts.userId,
    p_plan_name: opts.planName,
    p_start_date: opts.startDate ?? new Date().toISOString(),
    p_end_date: opts.endDate ?? null,
    p_status: opts.status ?? 'active',
    p_notes: opts.notes ?? null,
  });
  if (error) throw error;
  const payload = data as { success?: boolean; error?: string };
  if (!payload?.success) throw new Error(payload?.error || 'upsert_failed');
};

export const checkIsPlatformAdmin = async (): Promise<boolean> => {
  const { data, error } = await (supabase as any).rpc('is_platform_admin');
  if (error) return false;
  return Boolean(data);
};

export interface GenerateAccessCodePayload {
  leadId: string;
  planId: 'annual' | 'yearly';
  agreedPrice?: number;
  storeName?: string;
  username?: string;
  notes?: string;
}

export const generateAccessCode = async (
  payload: GenerateAccessCodePayload
): Promise<{
  accessCode: string;
  codeId: string;
  planId: string;
  durationMonths: number;
  agreedPrice: number | null;
  codeExpiresAt: string;
  storeName: string;
  username: string;
  message?: string;
}> => {
  const { data, error } = await (supabase as any).rpc('admin_generate_access_code', {
    p_lead_id: payload.leadId,
    p_plan_id: payload.planId,
    p_agreed_price: payload.agreedPrice ?? null,
    p_store_name: payload.storeName ?? null,
    p_notes: payload.notes ?? null,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/function|schema cache/i.test(msg)) {
      throw new Error('قاعدة البيانات تحتاج تحديث — npm run db:deploy');
    }
    throw new Error(msg);
  }

  const result = data as {
    success?: boolean;
    error?: string;
    access_code?: string;
    plan_id?: string;
    duration_months?: number;
    agreed_price?: number | null;
    code_expires_at?: string;
    message?: string;
  };

  if (!result?.success || !result.access_code) {
    throw new Error(result?.error || 'generate_failed');
  }

  return {
    accessCode: result.access_code,
    codeId: payload.leadId,
    planId: result.plan_id ?? payload.planId,
    durationMonths: result.duration_months ?? (payload.planId === 'yearly' ? 12 : 6),
    agreedPrice: result.agreed_price ?? null,
    codeExpiresAt: result.code_expires_at ?? '',
    storeName: payload.storeName ?? '',
    username: '',
    message: result.message,
  };
};

export const redeemAccessCode = async (code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: number;
  username: string;
  storeName: string;
  subscriptionEndAt?: string | null;
}> => {
  const { data, error } = await supabase.functions.invoke('redeem-access-code', {
    body: { code: code.trim() },
  });

  if (error) throw new Error(error.message);
  const result = data as {
    success?: boolean;
    error?: string;
    session?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at?: number;
    };
    user?: { username: string; store_name: string };
    subscription_end_at?: string | null;
  };

  if (!result?.success || !result.session) {
    throw new Error(result?.error || 'redeem_failed');
  }

  return {
    accessToken: result.session.access_token,
    refreshToken: result.session.refresh_token,
    expiresIn: result.session.expires_in,
    expiresAt: result.session.expires_at,
    username: result.user?.username ?? 'مستخدم',
    storeName: result.user?.store_name ?? 'متجري',
    subscriptionEndAt: result.subscription_end_at,
  };
};

export const fetchLeadAccessCodes = async (leadId: string) => {
  const { data, error } = await (supabase as any).rpc('admin_list_lead_access_codes', {
    p_lead_id: leadId,
  });
  if (error) throw error;
  const payload = data as { success?: boolean; rows?: unknown[]; error?: string };
  if (!payload?.success) throw new Error(payload?.error || 'forbidden');
  return (payload.rows ?? []) as import('@/types/accessCodes').AccessCodeRecord[];
};

