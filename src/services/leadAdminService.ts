import { supabase } from '@/integrations/supabase/client';
import type { LeadRecord, LeadStatus } from '@/types/leads';
import {
  matchesLeadQuickFilter,
  type LeadQuickFilter,
} from '@/utils/leadWorkflowUtils';

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
  filter?: LeadQuickFilter | '';
  limit?: number;
  offset?: number;
}): Promise<{ rows: LeadRecord[]; total: number }> => {
  const filter = opts.filter && opts.filter !== 'all' ? opts.filter : null;
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const baseArgs = {
    p_search: opts.search || null,
    p_status: opts.status || null,
    p_limit: limit,
    p_offset: offset,
  };

  let data: unknown;
  let error: { message?: string } | null = null;
  let usedClientFilter = false;

  ({ data, error } = await (supabase as any).rpc('admin_list_leads', {
    ...baseArgs,
    p_filter: filter,
  }));

  if (error && filter && /admin_list_leads|p_filter|schema cache|could not find/i.test(error.message ?? '')) {
    usedClientFilter = true;
    ({ data, error } = await (supabase as any).rpc('admin_list_leads', {
      ...baseArgs,
      p_limit: 1000,
      p_offset: 0,
    }));
  }

  if (error) throw error;
  const payload = data as { success?: boolean; rows?: LeadRecord[]; total?: number; error?: string };
  if (!payload?.success) throw new Error(payload?.error || 'forbidden');

  let rows = payload.rows ?? [];
  let total = payload.total ?? rows.length;

  if (usedClientFilter && filter) {
    rows = rows.filter((row) => matchesLeadQuickFilter(row, filter));
    total = rows.length;
    rows = rows.slice(offset, offset + limit);
  }

  return { rows, total };
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

export type LeadStatsPayload = {
  total: number;
  new_count: number;
  unread_count: number;
  needs_code_count: number;
  pending_activation_count: number;
  pipeline_count: number;
  customer_count: number;
  today_count: number;
};

export const fetchLeadStats = async (): Promise<LeadStatsPayload | null> => {
  const { data, error } = await (supabase as any).rpc('admin_leads_stats');
  if (error) return null;
  const payload = data as { success?: boolean } & LeadStatsPayload;
  if (!payload?.success) return null;
  return {
    total: payload.total ?? 0,
    new_count: payload.new_count ?? 0,
    unread_count: payload.unread_count ?? 0,
    needs_code_count: payload.needs_code_count ?? 0,
    pending_activation_count: payload.pending_activation_count ?? 0,
    pipeline_count: payload.pipeline_count ?? 0,
    customer_count: payload.customer_count ?? 0,
    today_count: payload.today_count ?? 0,
  };
};

export const markLeadContacted = async (leadId: string): Promise<void> => {
  const { data, error } = await (supabase as any).rpc('admin_mark_lead_contacted', {
    p_lead_id: leadId,
  });
  if (error) throw error;
  const payload = data as { success?: boolean; error?: string };
  if (!payload?.success) throw new Error(payload?.error || 'mark_failed');
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

type RedeemFunctionResult = {
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

const parseRedeemFunctionResult = async (
  data: unknown,
  error: { message?: string; context?: Response } | null
): Promise<RedeemFunctionResult> => {
  if (data && typeof data === 'object' && ('success' in data || 'error' in data || 'session' in data)) {
    return data as RedeemFunctionResult;
  }

  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = (await error.context.json()) as RedeemFunctionResult;
      if (body && typeof body === 'object') return body;
    } catch {
      /* ignore malformed edge response */
    }
  }

  const msg = error?.message ?? '';
  if (/401|403|non-2xx|jwt|unauthorized/i.test(msg)) {
    return { success: false, error: 'edge_unavailable' };
  }
  if (/failed to fetch|network/i.test(msg)) {
    throw new Error('network_error');
  }
  return { success: false, error: msg || 'redeem_failed' };
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

  const result = await parseRedeemFunctionResult(data, error as { message?: string; context?: Response } | null);

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

