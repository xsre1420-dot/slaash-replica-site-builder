import { supabase } from '@/integrations/supabase/client';
import {
  enforceRateLimit,
  formatRateLimitMessageAr,
  RATE_LIMITS,
  RateLimitExceededError,
} from '@/lib/security/rateLimiter';
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

export const extendSubscription = async (
  leadId: string,
  opts: { extraMonths?: number; reason?: string } = {}
): Promise<{ subscriptionEndAt: string; subscriptionStartAt: string | null }> => {
  const { data, error } = await (supabase as any).rpc('admin_extend_subscription', {
    p_lead_id: leadId,
    p_extra_months: opts.extraMonths ?? 6,
    p_reason: opts.reason ?? null,
  });
  if (error) throw new Error(parseSupabaseRpcError(error));
  const result = data as {
    success?: boolean;
    error?: string;
    subscription_end_at?: string;
    subscription_start_at?: string | null;
  };
  if (!result?.success || !result.subscription_end_at) {
    throw new Error(result?.error || 'extend_failed');
  }
  return {
    subscriptionEndAt: result.subscription_end_at,
    subscriptionStartAt: result.subscription_start_at ?? null,
  };
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

const parseSupabaseRpcError = (error: { message?: string; code?: string; details?: string }): string => {
  const msg = [error.message, error.details, error.code].filter(Boolean).join(' ');
  if (/PGRST202|schema cache|Could not find the function/i.test(msg)) {
    return 'db_migration_required';
  }
  if (/function|schema cache/i.test(msg)) {
    return 'db_migration_required';
  }
  return error.message ?? 'rpc_failed';
};

export const generateAccessCode = async (
  payload: GenerateAccessCodePayload
): Promise<{
  accessCode: string;
  codeId: string;
  planId: string;
  durationMonths: number;
  agreedPrice: number | null;
  codeExpiresAt: string;
  subscriptionStartAt: string | null;
  subscriptionEndAt: string | null;
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
    throw new Error(parseSupabaseRpcError(error));
  }

  const result = data as {
    success?: boolean;
    error?: string;
    access_code?: string;
    code_id?: string;
    plan_id?: string;
    duration_months?: number;
    agreed_price?: number | null;
    code_expires_at?: string;
    subscription_start_at?: string | null;
    subscription_end_at?: string | null;
    message?: string;
    code_hint?: string;
  };

  if (!result?.success || !result.access_code) {
    throw new Error(result?.error || 'generate_failed');
  }

  return {
    accessCode: result.access_code,
    codeId: result.code_id ?? payload.leadId,
    planId: result.plan_id ?? payload.planId,
    durationMonths: result.duration_months ?? (payload.planId === 'yearly' ? 12 : 6),
    agreedPrice: result.agreed_price ?? null,
    codeExpiresAt: result.code_expires_at ?? '',
    subscriptionStartAt: result.subscription_start_at ?? null,
    subscriptionEndAt: result.subscription_end_at ?? null,
    storeName: payload.storeName ?? '',
    username: '',
    message: result.message,
  };
};

type RedeemFunctionResult = {
  success?: boolean;
  error?: string;
  preview?: boolean;
  plan_id?: string;
  duration_months?: number;
  agreed_price?: number | null;
  store_name?: string | null;
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
      const body = (await error.context.json()) as RedeemFunctionResult & { error?: string };
      if (body && typeof body === 'object') {
        if (body.error === 'Forbidden origin') {
          return { success: false, error: 'cors_blocked' };
        }
        return body;
      }
    } catch {
      /* ignore malformed edge response */
    }
  }

  const msg = error?.message ?? '';
  if (/403|forbidden origin/i.test(msg)) {
    return { success: false, error: 'cors_blocked' };
  }
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
  try {
    enforceRateLimit('access_code_redeem', RATE_LIMITS.accessCode);
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      throw new Error(formatRateLimitMessageAr(err.retryAfterMs));
    }
    throw err;
  }

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

export const revokeLeadAccessCode = async (
  leadId: string,
  opts?: { codeId?: string; reason?: string }
): Promise<{ codeId: string; codeHint: string }> => {
  const { data, error } = await (supabase as any).rpc('admin_revoke_lead_access_code', {
    p_lead_id: leadId,
    p_code_id: opts?.codeId ?? null,
    p_reason: opts?.reason ?? 'lost-by-customer',
  });

  if (error) {
    throw new Error(parseSupabaseRpcError(error));
  }

  const result = data as {
    success?: boolean;
    error?: string;
    code_id?: string;
    code_hint?: string;
  };

  if (!result?.success || !result.code_id) {
    throw new Error(result?.error || 'revoke_failed');
  }

  return { codeId: result.code_id, codeHint: result.code_hint ?? '****' };
};

export const replaceLeadAccessCode = async (
  leadId: string,
  opts?: { codeId?: string; reason?: string; planId?: string; durationMonths?: number; agreedPrice?: number | null; storeName?: string }
): Promise<{
  accessCode: string;
  codeId: string;
  planId: string;
  durationMonths: number;
  agreedPrice: number | null;
  replacedCodeHint: string | null;
  codeExpiresAt?: string;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
}> => {
  const { data, error } = await (supabase as any).rpc('admin_replace_lead_access_code', {
    p_lead_id: leadId,
    p_code_id: opts?.codeId ?? null,
    p_reason: opts?.reason ?? 'replaced-by-admin',
  });

  if (error) {
    const parsed = parseSupabaseRpcError(error);
    if (parsed === 'db_migration_required' && opts?.planId) {
      try {
        await revokeLeadAccessCode(leadId, { codeId: opts.codeId, reason: opts.reason });
        const generated = await generateAccessCode({
          leadId,
          planId: opts.planId as 'annual' | 'yearly',
          agreedPrice: opts.agreedPrice ?? undefined,
          storeName: opts.storeName,
        });
        return {
          accessCode: generated.accessCode,
          codeId: generated.codeId,
          planId: generated.planId,
          durationMonths: generated.durationMonths,
          agreedPrice: generated.agreedPrice,
          replacedCodeHint: null,
        };
      } catch {
        throw new Error('db_migration_required');
      }
    }
    throw new Error(parsed);
  }

  const result = data as {
    success?: boolean;
    error?: string;
    access_code?: string;
    code_id?: string;
    plan_id?: string;
    duration_months?: number;
    agreed_price?: number | null;
    replaced_code_hint?: string;
    code_expires_at?: string;
    subscription_start_at?: string | null;
    subscription_end_at?: string | null;
  };

  if (!result?.success || !result.access_code || !result.code_id) {
    throw new Error(result?.error || 'replace_failed');
  }

  return {
    accessCode: result.access_code,
    codeId: result.code_id,
    planId: result.plan_id ?? 'annual',
    durationMonths: result.duration_months ?? 6,
    agreedPrice: result.agreed_price ?? null,
    replacedCodeHint: result.replaced_code_hint ?? null,
    codeExpiresAt: result.code_expires_at,
    subscriptionStartAt: result.subscription_start_at ?? null,
    subscriptionEndAt: result.subscription_end_at ?? null,
  };
};

export const reissueLeadAccessCode = async (
  leadId: string,
  opts: {
    planId?: string;
    agreedPrice?: number | null;
    storeName?: string;
    notes?: string;
    codeId?: string;
  } = {}
): Promise<{
  accessCode: string;
  codeId: string;
  planId: string;
  durationMonths: number;
  agreedPrice: number | null;
  codeExpiresAt?: string;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
}> => {
  const replaceOpts = {
    codeId: opts.codeId,
    reason: opts.notes ?? 'reissued-for-active-customer',
    planId: opts.planId,
    agreedPrice: opts.agreedPrice,
    storeName: opts.storeName,
  };

  if (opts.codeId) {
    const replaced = await replaceLeadAccessCode(leadId, replaceOpts);
    return {
      accessCode: replaced.accessCode,
      codeId: replaced.codeId,
      planId: replaced.planId,
      durationMonths: replaced.durationMonths,
      agreedPrice: replaced.agreedPrice,
      codeExpiresAt: replaced.codeExpiresAt,
      subscriptionStartAt: replaced.subscriptionStartAt,
      subscriptionEndAt: replaced.subscriptionEndAt,
    };
  }

  try {
    const result = await generateAccessCode({
      leadId,
      planId: (opts.planId ?? 'annual') as 'annual' | 'yearly',
      agreedPrice: opts.agreedPrice ?? undefined,
      storeName: opts.storeName,
      notes: opts.notes ?? 'reissued-for-active-customer',
    });
    return {
      accessCode: result.accessCode,
      codeId: result.codeId,
      planId: result.planId,
      durationMonths: result.durationMonths,
      agreedPrice: result.agreedPrice,
      codeExpiresAt: result.codeExpiresAt,
      subscriptionStartAt: result.subscriptionStartAt,
      subscriptionEndAt: result.subscriptionEndAt,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'generate_failed';
    if (code === 'active_code_exists') {
      const replaced = await replaceLeadAccessCode(leadId, replaceOpts);
      return {
        accessCode: replaced.accessCode,
        codeId: replaced.codeId,
        planId: replaced.planId,
        durationMonths: replaced.durationMonths,
        agreedPrice: replaced.agreedPrice,
        codeExpiresAt: replaced.codeExpiresAt,
        subscriptionStartAt: replaced.subscriptionStartAt,
        subscriptionEndAt: replaced.subscriptionEndAt,
      };
    }
    throw err;
  }
};

export const issueNewLoginCodeForConvertedLead = async (
  leadId: string,
  opts: {
    planId?: string;
    agreedPrice?: number | null;
    storeName?: string;
    notes?: string;
  },
  codes: import('@/types/accessCodes').AccessCodeRecord[] = []
) => {
  const active = codes.find((c) => c.status === 'active');
  return reissueLeadAccessCode(leadId, {
    ...opts,
    codeId: active?.id,
    notes: opts.notes ?? (active ? 'replaced: customer lost login code' : 'reissued-for-active-customer'),
  });
};

export const verifyLeadAccessCode = async (
  leadId: string,
  plainCode: string
): Promise<import('@/types/accessCodes').AccessCodeVerifyResult> => {
  const { data, error } = await (supabase as any).rpc('admin_verify_lead_access_code', {
    p_lead_id: leadId,
    p_plain_code: plainCode.trim(),
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
    code_id?: string;
    code_hint?: string;
    plan_id?: string;
    plan_label?: string;
    duration_months?: number;
    agreed_price?: number | null;
    store_name?: string | null;
    created_at?: string;
  };

  if (!result?.success || !result.code_id) {
    throw new Error(result?.error || 'invalid_code');
  }

  return {
    codeId: result.code_id,
    codeHint: result.code_hint ?? '****',
    planId: result.plan_id ?? 'annual',
    planLabel: result.plan_label ?? result.plan_id ?? 'annual',
    durationMonths: result.duration_months ?? 6,
    agreedPrice: result.agreed_price ?? null,
    storeName: result.store_name ?? null,
    createdAt: result.created_at ?? new Date().toISOString(),
  };
};

export const previewAccessCode = async (code: string): Promise<import('@/types/accessCodes').AccessCodePreview> => {
  const { data, error } = await supabase.functions.invoke('redeem-access-code', {
    body: { code: code.trim(), preview: true },
  });

  const result = await parseRedeemFunctionResult(data, error);

  if (!result.success || !result.preview) {
    throw new Error(result.error || 'invalid_code');
  }

  const payload = result as {
    plan_id?: string;
    duration_months?: number;
    agreed_price?: number | null;
    store_name?: string | null;
  };

  return {
    planId: payload.plan_id ?? 'annual',
    durationMonths: payload.duration_months ?? 6,
    agreedPrice: payload.agreed_price ?? null,
    storeName: payload.store_name ?? null,
  };
};

