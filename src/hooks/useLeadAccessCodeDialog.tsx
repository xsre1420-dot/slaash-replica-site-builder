import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchLeadAccessCodes,
  issueNewLoginCodeForConvertedLead,
  replaceLeadAccessCode,
} from '@/services/leadAdminService';
import type { AccessCodeRecord } from '@/types/accessCodes';
import { ACCESS_CODE_ERROR_MESSAGES } from '@/types/accessCodes';
import type { LeadRecord } from '@/types/leads';
import { canUseAccessCodeByExpiry } from '@/utils/accessCodeExpiryUtils';
import {
  canCreateAccessCodeForLead,
  canManageAccessCodeForLead,
  canReissueAccessCodeForLead,
  getLastRedeemedAccessCode,
  getRawActiveAccessCode,
  getUsableActiveAccessCode,
  hasActiveAccessCode,
  isConvertedLead,
} from '@/utils/leadAccessCodeUtils';
import { saveGeneratedAccessCode } from '@/utils/accessCodeSessionStore';

type CodeDialogDeliver = {
  accessCode: string;
  codeId: string;
  meta: {
    planId: string;
    durationMonths: number;
    agreedPrice: number | null;
    subscriptionEndAt?: string | null;
    subscriptionStartAt?: string | null;
    codeExpiresAt?: string | null;
    convertedCustomer?: boolean;
  };
};

type UseLeadAccessCodeDialogOptions = {
  onCodesChanged?: (leadId: string, codes: AccessCodeRecord[]) => void;
  onLeadPatch?: (leadId: string, patch: Partial<LeadRecord>) => void;
};

export const useLeadAccessCodeDialog = (options: UseLeadAccessCodeDialogOptions = {}) => {
  const { onCodesChanged, onLeadPatch } = options;

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeLead, setCodeLead] = useState<LeadRecord | null>(null);
  const [codes, setCodes] = useState<AccessCodeRecord[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [replacingCode, setReplacingCode] = useState(false);
  const [revealedAccessCode, setRevealedAccessCode] = useState<string | null>(null);
  const [codeDialogDeliver, setCodeDialogDeliver] = useState<CodeDialogDeliver | null>(null);

  const activeCodeRecord = getUsableActiveAccessCode(codes);
  const lastRedeemedCode = getLastRedeemedAccessCode(codes);

  const loadCodes = useCallback(
    async (leadId: string) => {
      setCodesLoading(true);
      try {
        const rows = await fetchLeadAccessCodes(leadId);
        setCodes(rows);
        onCodesChanged?.(leadId, rows);
        const hasPending = rows.some(
          (c) => c.status === 'active' && canUseAccessCodeByExpiry(c)
        );
        onLeadPatch?.(leadId, { has_pending_code: hasPending });
        return rows;
      } catch {
        setCodes([]);
        toast.error('تعذر تحميل رموز الدخول');
        return [];
      } finally {
        setCodesLoading(false);
      }
    },
    [onCodesChanged, onLeadPatch]
  );

  const applyCodeResult = useCallback(
    (
      leadId: string,
      result: {
        accessCode: string;
        codeId: string;
        planId: string;
        durationMonths: number;
        agreedPrice: number | null;
        codeExpiresAt?: string;
        subscriptionStartAt?: string | null;
        subscriptionEndAt?: string | null;
      },
      convertedCustomer = false
    ) => {
      saveGeneratedAccessCode({
        leadId,
        codeId: result.codeId,
        accessCode: result.accessCode,
        createdAt: new Date().toISOString(),
      });
      setRevealedAccessCode(result.accessCode);
      setCodeDialogDeliver({
        accessCode: result.accessCode,
        codeId: result.codeId,
        meta: {
          planId: result.planId,
          durationMonths: result.durationMonths,
          agreedPrice: result.agreedPrice,
          subscriptionStartAt: result.subscriptionStartAt,
          subscriptionEndAt: result.subscriptionEndAt,
          codeExpiresAt: result.codeExpiresAt,
          convertedCustomer,
        },
      });
      onLeadPatch?.(leadId, { has_pending_code: true });
      setCodeOpen(true);
    },
    [onLeadPatch]
  );

  const openCodeDialog = useCallback(
    async (lead: LeadRecord) => {
      setCodeLead(lead);
      setRevealedAccessCode(null);
      setCodeDialogDeliver(null);

      const rows = await loadCodes(lead.id);
      const rawActive = getRawActiveAccessCode(rows);
      const leadAfterFetch: LeadRecord = {
        ...lead,
        has_pending_code: rows.some(
          (c) => c.status === 'active' && canUseAccessCodeByExpiry(c)
        ),
      };

      if (hasActiveAccessCode(rows) || (isConvertedLead(leadAfterFetch) && rawActive)) {
        setCodeLead(leadAfterFetch);
        setCodeOpen(true);
        return;
      }

      if (isConvertedLead(leadAfterFetch)) {
        if (canReissueAccessCodeForLead(leadAfterFetch, rows)) {
          setCodeLead(leadAfterFetch);
          setCodeOpen(true);
          return;
        }
        toast.error('انتهى اشتراك هذا العميل — يجب تجديد الاشتراك قبل إنشاء رمز جديد');
        return;
      }

      if (!canCreateAccessCodeForLead(leadAfterFetch, rows, { codesFetched: true })) {
        toast.info('لا يمكن إنشاء رمز لهذا الطلب');
        return;
      }

      setCodeLead(leadAfterFetch);
      setCodeOpen(true);
    },
    [loadCodes]
  );

  const handleReissueCode = useCallback(async (): Promise<{ accessCode: string; codeId: string } | void> => {
    if (!codeLead) return;
    setReplacingCode(true);
    try {
      const template = lastRedeemedCode;
      const result = await issueNewLoginCodeForConvertedLead(
        codeLead.id,
        {
          planId: template?.plan_id ?? codeLead.selected_plan_id ?? 'annual',
          agreedPrice: template?.agreed_price,
          storeName: template?.store_name ?? codeLead.full_name,
        },
        codes
      );
      applyCodeResult(codeLead.id, result, isConvertedLead(codeLead));
      await loadCodes(codeLead.id);
      toast.success('تم إنشاء رمز جديد — أرسله للعميل الآن');
      return { accessCode: result.accessCode, codeId: result.codeId };
    } catch (err) {
      const code = err instanceof Error ? err.message : 'generate_failed';
      if (code === 'lead_already_converted') {
        toast.error('شغّل npm run db:deploy لتحديث نظام الرموز، ثم أعد المحاولة');
      } else {
        toast.error(ACCESS_CODE_ERROR_MESSAGES[code] || 'تعذر إنشاء الرمز');
      }
    } finally {
      setReplacingCode(false);
    }
  }, [applyCodeResult, codeLead, codes, lastRedeemedCode, loadCodes]);

  const handleReplaceCode = useCallback(async (): Promise<{ accessCode: string; codeId: string } | void> => {
    if (!codeLead) return;
    setReplacingCode(true);
    try {
      const activeCode = codes.find((c) => c.status === 'active');
      const result = await replaceLeadAccessCode(codeLead.id, {
        codeId: activeCode?.id,
        reason: 'replaced-by-admin: same subscription terms',
        planId: activeCode?.plan_id ?? lastRedeemedCode?.plan_id ?? codeLead.selected_plan_id ?? 'annual',
        durationMonths: activeCode?.duration_months ?? lastRedeemedCode?.duration_months,
        agreedPrice: activeCode?.agreed_price ?? lastRedeemedCode?.agreed_price,
        storeName: activeCode?.store_name ?? lastRedeemedCode?.store_name ?? codeLead.full_name,
      });
      applyCodeResult(codeLead.id, result, isConvertedLead(codeLead));
      await loadCodes(codeLead.id);
      toast.success('تم إنشاء الرمز — أرسله للعميل الآن');
      return { accessCode: result.accessCode, codeId: result.codeId };
    } catch (err) {
      const code = err instanceof Error ? err.message : 'replace_failed';
      if (code === 'no_active_code' && isConvertedLead(codeLead)) {
        return handleReissueCode();
      }
      toast.error(ACCESS_CODE_ERROR_MESSAGES[code] || 'تعذر استبدال الرمز');
    } finally {
      setReplacingCode(false);
    }
  }, [applyCodeResult, codeLead, codes, handleReissueCode, lastRedeemedCode, loadCodes]);

  const handleGenerated = useCallback(
    ({
      accessCode,
      codeId,
      meta,
    }: {
      accessCode: string;
      codeId: string;
      meta?: CodeDialogDeliver['meta'];
    }) => {
      setRevealedAccessCode(accessCode);
      if (meta) {
        setCodeDialogDeliver({ accessCode, codeId, meta });
      }
      if (codeLead) {
        onLeadPatch?.(codeLead.id, {
          has_pending_code: true,
          status:
            codeLead.status === 'new' || codeLead.status === 'contacted'
              ? 'interested'
              : codeLead.status,
        });
        void loadCodes(codeLead.id);
      }
    },
    [codeLead, loadCodes, onLeadPatch]
  );

  const closeCodeDialog = useCallback((open: boolean) => {
    setCodeOpen(open);
    if (!open) setCodeDialogDeliver(null);
  }, []);

  const canManageCode = codeLead
    ? canManageAccessCodeForLead(codeLead, codes)
    : false;

  const canReissueCode = codeLead
    ? canReissueAccessCodeForLead(codeLead, codes)
    : false;

  return {
    codeOpen,
    setCodeOpen: closeCodeDialog,
    codeLead,
    codes,
    codesLoading,
    replacingCode,
    revealedAccessCode,
    codeDialogDeliver,
    activeCodeRecord,
    lastRedeemedCode,
    canManageCode,
    canReissueCode,
    loadCodes,
    openCodeDialog,
    handleReplaceCode,
    handleReissueCode,
    handleGenerated,
    resetForLead: () => {
      setRevealedAccessCode(null);
      setCodeDialogDeliver(null);
    },
  };
};
