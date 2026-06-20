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
    throw new LeadSubmitError(error.message);
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

export interface ConvertLeadPayload {
  leadId: string;
  email: string;
  username: string;
  password: string;
  storeName?: string;
  planName?: string;
  endDate?: string | null;
}

export const convertLeadToCustomer = async (payload: ConvertLeadPayload): Promise<{
  userId: string;
  email: string;
  username: string;
}> => {
  const { data, error } = await supabase.functions.invoke('convert-lead', {
    body: {
      lead_id: payload.leadId,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      store_name: payload.storeName,
      plan_name: payload.planName ?? 'standard',
      end_date: payload.endDate ?? null,
    },
  });

  if (error) throw new Error(error.message);
  const result = data as { success?: boolean; error?: string; user_id?: string; email?: string; username?: string };
  if (!result?.success) throw new Error(result?.error || 'conversion_failed');
  return {
    userId: result.user_id!,
    email: result.email!,
    username: result.username!,
  };
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
