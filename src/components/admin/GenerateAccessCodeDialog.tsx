import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AccessCodeDeliverStep, { type AccessCodeDeliverMeta } from '@/components/admin/AccessCodeDeliverStep';
import {
  generateAccessCode,
  issueNewLoginCodeForConvertedLead,
  replaceLeadAccessCode,
  verifyLeadAccessCode,
} from '@/services/leadAdminService';
import {
  ACCESS_CODE_ERROR_MESSAGES,
  formatAccessCodeInput,
  formatAccessCodeForSubmit,
  type AccessCodeRecord,
} from '@/types/accessCodes';
import type { LeadRecord } from '@/types/leads';
import { buildWhatsAppUrl } from '@/types/leads';
import { buildInitialWhatsAppMessage } from '@/utils/leadWorkflowUtils';
import { canReissueAccessCodeForLead, getLastRedeemedAccessCode, getRawActiveAccessCode, getUsableActiveAccessCode, hasActiveAccessCode, hasBlockingActiveAccessCode, hasStalePendingCodeFlag, isConvertedLead, resolveAccessCodeDialogMode } from '@/utils/leadAccessCodeUtils';
import {
  formatAccessCodeExpiryLabel,
  getAccessCodeEffectiveEnd,
  getRemainingSubscriptionMonths,
} from '@/utils/accessCodeExpiryUtils';
import { getStoredAccessCodeForLead, saveGeneratedAccessCode } from '@/utils/accessCodeSessionStore';
import { PUBLIC_SUBSCRIPTION_PLANS, getPublicPlanById } from '@/data/subscriptionPlans';
import { planLabelForLead } from '@/utils/subscriptionPlanLabels';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const planLabelFor = (planId: string) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.name ??
  (planId === 'yearly' ? 'باقة سنوية' : 'باقة 6 أشهر');

type PlanId = 'annual' | 'yearly';
type DialogStep = 'configure' | 'manage' | 'verify' | 'deliver' | 'reissue';

const defaultPlanForLead = (lead: LeadRecord): PlanId => {
  if (lead.selected_plan_id === 'yearly') return 'yearly';
  if (lead.selected_plan_id === 'annual') return 'annual';
  const name = lead.selected_plan_name?.trim() ?? '';
  if (/سنو|yearly|12/i.test(name)) return 'yearly';
  return 'annual';
};

const resolveLeadSelectedPlan = (lead: LeadRecord) => {
  const byId = getPublicPlanById(lead.selected_plan_id);
  if (byId) return byId;

  const name = lead.selected_plan_name?.trim() ?? '';
  if (!name) return null;
  if (/سنو|yearly|12\s*ش/i.test(name)) return getPublicPlanById('yearly') ?? null;
  if (/6\s*أ|annual|نصف/i.test(name)) return getPublicPlanById('annual') ?? null;

  return null;
};

const defaultPriceForPlan = (planId: PlanId) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.priceAmount ?? 125_000;

type GenerateAccessCodeDialogProps = {
  lead: LeadRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (payload: {
    accessCode: string;
    codeId: string;
    meta?: AccessCodeDeliverMeta;
  }) => void;
  activeCode?: AccessCodeRecord | null;
  codes?: AccessCodeRecord[];
  initialStep?: DialogStep;
  /** Open directly on deliver step with a freshly created/replaced code. */
  initialDeliver?: {
    accessCode: string;
    codeId: string;
    meta: AccessCodeDeliverMeta;
  } | null;
  /** When set, reissue/replace delegate to hook (single source of truth). */
  onReissue?: () => Promise<{ accessCode: string; codeId: string } | void>;
  onReplace?: () => Promise<{ accessCode: string; codeId: string } | void>;
  replacing?: boolean;
};

export const GenerateAccessCodeDialog = ({
  lead,
  open,
  onOpenChange,
  onGenerated,
  activeCode = null,
  codes = [],
  initialStep,
  initialDeliver = null,
  onReissue,
  onReplace,
  replacing: externalReplacing = false,
}: GenerateAccessCodeDialogProps) => {
  const [step, setStep] = useState<DialogStep>('configure');
  const [planId, setPlanId] = useState<PlanId>('annual');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [showPrice, setShowPrice] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeId, setCodeId] = useState<string | null>(null);
  const [deliverMeta, setDeliverMeta] = useState<AccessCodeDeliverMeta | null>(null);
  const [generating, setGenerating] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const isReplacing = externalReplacing || replacing;
  const [verifyInput, setVerifyInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  /** Keeps deliver step stable while parent refreshes codes after generation. */
  const pendingDeliverRef = useRef<{
    accessCode: string;
    codeId: string;
    meta: AccessCodeDeliverMeta;
  } | null>(null);

  const resetState = () => {
    pendingDeliverRef.current = null;
    setStep('configure');
    setGeneratedCode(null);
    setCodeId(null);
    setDeliverMeta(null);
    setVerifyInput('');
    setShowPrice(false);
  };

  useEffect(() => {
    if (!lead || !open) return;

    if (pendingDeliverRef.current) {
      const pending = pendingDeliverRef.current;
      setStep('deliver');
      setGeneratedCode(pending.accessCode);
      setCodeId(pending.codeId);
      setDeliverMeta(pending.meta);
      setVerifyInput('');
      return;
    }

    if (initialDeliver) {
      pendingDeliverRef.current = {
        accessCode: initialDeliver.accessCode,
        codeId: initialDeliver.codeId,
        meta: initialDeliver.meta,
      };
      setStep('deliver');
      setGeneratedCode(initialDeliver.accessCode);
      setCodeId(initialDeliver.codeId);
      setDeliverMeta(initialDeliver.meta);
      setVerifyInput('');
      return;
    }

    const stored =
      (activeCode != null
        ? getStoredAccessCodeForLead(lead.id, activeCode.id)
        : null) ?? getStoredAccessCodeForLead(lead.id);

    if (initialStep) {
      setStep(initialStep);
    } else if (stored && activeCode) {
      setStep('deliver');
      setGeneratedCode(stored);
      setCodeId(activeCode.id);
      setDeliverMeta({
        planId: activeCode.plan_id,
        durationMonths: activeCode.duration_months,
        agreedPrice: activeCode.agreed_price,
        subscriptionStartAt: activeCode.subscription_start_at,
        subscriptionEndAt: activeCode.subscription_end_at,
        codeExpiresAt: activeCode.code_expires_at,
        convertedCustomer: isConvertedLead(lead),
      });
    } else {
      const mode = resolveAccessCodeDialogMode(lead, codes);
      if (mode === 'reissue') {
        setStep('reissue');
        setGeneratedCode(null);
        const template = getLastRedeemedAccessCode(codes);
        if (template) {
          const tplPlan: PlanId = template.plan_id === 'yearly' ? 'yearly' : 'annual';
          setPlanId(tplPlan);
          setAgreedPrice(
            String(template.agreed_price ?? defaultPriceForPlan(tplPlan))
          );
        }
      } else if (mode === 'manage' && activeCode) {
        setStep('manage');
        setCodeId(activeCode.id);
        setDeliverMeta({
          planId: activeCode.plan_id,
          durationMonths: activeCode.duration_months,
          agreedPrice: activeCode.agreed_price,
          subscriptionStartAt: activeCode.subscription_start_at,
        subscriptionEndAt: activeCode.subscription_end_at,
          codeExpiresAt: activeCode.code_expires_at,
          convertedCustomer: isConvertedLead(lead),
        });
        setGeneratedCode(null);
      } else {
        setStep('configure');
      }
    }

    const plan = defaultPlanForLead(lead);
    setPlanId(plan);
    setAgreedPrice(String(defaultPriceForPlan(plan)));
    setVerifyInput('');
  }, [lead, open, activeCode, codes, initialStep, initialDeliver]);

  const selectedPlan = useMemo(
    () => PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId),
    [planId]
  );

  const leadSelectedPlan = useMemo(
    () => (lead ? resolveLeadSelectedPlan(lead) : null),
    [lead]
  );

  const configurablePlans = useMemo(
    () => (leadSelectedPlan ? [leadSelectedPlan] : PUBLIC_SUBSCRIPTION_PLANS),
    [leadSelectedPlan]
  );

  const planLockedToLead = configurablePlans.length === 1;

  const handlePlanPick = (next: PlanId) => {
    setPlanId(next);
    setAgreedPrice(String(defaultPriceForPlan(next)));
  };

  const persistCode = (
    leadId: string,
    nextCodeId: string,
    accessCode: string,
    meta?: AccessCodeDeliverMeta
  ) => {
    saveGeneratedAccessCode({
      leadId,
      codeId: nextCodeId,
      accessCode,
      createdAt: new Date().toISOString(),
    });
    onGenerated?.({ accessCode, codeId: nextCodeId, meta });
  };

  const goDeliver = (
    accessCode: string,
    nextCodeId: string,
    meta: AccessCodeDeliverMeta
  ) => {
    pendingDeliverRef.current = { accessCode, codeId: nextCodeId, meta };
    setGeneratedCode(accessCode);
    setCodeId(nextCodeId);
    setDeliverMeta(meta);
    setStep('deliver');
  };

  const handleGenerate = async () => {
    if (!lead) return;
    if (isConvertedLead(lead)) {
      setStep('reissue');
      return;
    }

    setGenerating(true);
    try {
      const result = await generateAccessCode({
        leadId: lead.id,
        planId,
        agreedPrice: agreedPrice ? Number(agreedPrice) : defaultPriceForPlan(planId),
        storeName: lead.full_name,
      });
      const deliverMetaPayload = {
        planId: result.planId,
        durationMonths: result.durationMonths,
        agreedPrice: result.agreedPrice,
        codeExpiresAt: result.codeExpiresAt,
        subscriptionStartAt: result.subscriptionStartAt,
        subscriptionEndAt: result.subscriptionEndAt,
        convertedCustomer: false,
      };
      goDeliver(result.accessCode, result.codeId, deliverMetaPayload);
      persistCode(lead.id, result.codeId, result.accessCode, deliverMetaPayload);
      toast.success(
        usableActive || blockingActive
          ? 'تم استبدال الرمز القديم وإنشاء رمز جديد'
          : 'تم إنشاء الرمز'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'generate_failed';
      if (msg === 'lead_already_converted') {
        toast.error('شغّل npm run db:deploy لتحديث نظام الرموز، ثم أعد المحاولة');
        setStep('reissue');
        return;
      }
      toast.error(ACCESS_CODE_ERROR_MESSAGES[msg] || 'تعذر إنشاء الرمز');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async () => {
    if (!lead) return;
    const normalized = verifyInput.replace(/[^A-Za-z0-9]/g, '');
    if (normalized.length < 11) {
      toast.error('أدخل الرمز كاملاً');
      return;
    }
    setVerifying(true);
    try {
      const verified = await verifyLeadAccessCode(lead.id, verifyInput);
      const formattedCode = formatAccessCodeForSubmit(verifyInput) ?? verifyInput.trim();
      goDeliver(formattedCode, verified.codeId, {
        planId: verified.planId,
        durationMonths: verified.durationMonths,
        agreedPrice: verified.agreedPrice,
      });
      persistCode(lead.id, verified.codeId, formattedCode, {
        planId: verified.planId,
        durationMonths: verified.durationMonths,
        agreedPrice: verified.agreedPrice,
      });
      toast.success('الرمز صحيح — نفس شروط الاشتراك');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid_code';
      toast.error(ACCESS_CODE_ERROR_MESSAGES[msg] || 'الرمز غير صحيح لهذا العميل');
    } finally {
      setVerifying(false);
    }
  };

  const handleReissue = async () => {
    if (!lead) return;
    if (onReissue) {
      await onReissue();
      return;
    }
    setReplacing(true);
    try {
      const template = getLastRedeemedAccessCode(codes);
      const effectivePlan = (template?.plan_id ?? planId) as PlanId;
      const rawActive = getRawActiveAccessCode(codes) ?? activeCode;

      const result = isConvertedLead(lead)
        ? await issueNewLoginCodeForConvertedLead(
            lead.id,
            {
              planId: effectivePlan,
              agreedPrice:
                template?.agreed_price ??
                (agreedPrice ? Number(agreedPrice) : defaultPriceForPlan(effectivePlan)),
              storeName: template?.store_name ?? lead.full_name,
              notes: rawActive ? 'replaced: customer lost login code' : undefined,
            },
            codes
          )
        : await generateAccessCode({
            leadId: lead.id,
            planId: effectivePlan,
            agreedPrice:
              template?.agreed_price ??
              (agreedPrice ? Number(agreedPrice) : defaultPriceForPlan(effectivePlan)),
            storeName: template?.store_name ?? lead.full_name,
          }).then((generated) => ({
            accessCode: generated.accessCode,
            codeId: generated.codeId,
            planId: generated.planId,
            durationMonths: generated.durationMonths,
            agreedPrice: generated.agreedPrice,
            codeExpiresAt: generated.codeExpiresAt,
            subscriptionStartAt: generated.subscriptionStartAt,
            subscriptionEndAt: generated.subscriptionEndAt,
          }));

      const deliverMetaPayload = {
        planId: result.planId,
        durationMonths: result.durationMonths,
        agreedPrice: result.agreedPrice,
        codeExpiresAt: result.codeExpiresAt,
        subscriptionStartAt: result.subscriptionStartAt,
        subscriptionEndAt: result.subscriptionEndAt,
        convertedCustomer: isConvertedLead(lead),
      };
      goDeliver(result.accessCode, result.codeId, deliverMetaPayload);
      persistCode(lead.id, result.codeId, result.accessCode, deliverMetaPayload);
      toast.success(
        rawActive ? 'تم استبدال الرمز القديم وإنشاء رمز جديد' : 'تم إنشاء رمز جديد للعميل المُفعّل'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'generate_failed';
      if (msg === 'lead_already_converted') {
        toast.error('شغّل npm run db:deploy لتحديث نظام الرموز، ثم أعد المحاولة');
        setStep('reissue');
        return;
      }
      toast.error(ACCESS_CODE_ERROR_MESSAGES[msg] || 'تعذر إنشاء الرمز');
    } finally {
      setReplacing(false);
    }
  };

  const handleReplace = async () => {
    if (!lead) return;
    setConfirmReplaceOpen(false);
    if (onReplace) {
      await onReplace();
      return;
    }
    setReplacing(true);
    try {
      const result = await replaceLeadAccessCode(lead.id, {
        codeId: codeId ?? activeCode?.id,
        reason: 'replaced-by-admin: same subscription terms',
      });
      const deliverMetaPayload = {
        planId: result.planId,
        durationMonths: result.durationMonths,
        agreedPrice: result.agreedPrice,
        codeExpiresAt: result.codeExpiresAt,
        subscriptionStartAt: result.subscriptionStartAt,
        subscriptionEndAt: result.subscriptionEndAt,
        convertedCustomer: isConvertedLead(lead),
      };
      goDeliver(result.accessCode, result.codeId, deliverMetaPayload);
      persistCode(lead.id, result.codeId, result.accessCode, deliverMetaPayload);
      toast.success('تم إنشاء رمز جديد بنفس شروط الاشتراك');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'replace_failed';
      toast.error(ACCESS_CODE_ERROR_MESSAGES[msg] || 'تعذر استبدال الرمز');
    } finally {
      setReplacing(false);
    }
  };

  const copyCode = async () => {
    if (!generatedCode) return;
    const formatted = formatAccessCodeForSubmit(generatedCode) ?? generatedCode.trim();
    await navigator.clipboard.writeText(formatted);
    toast.success('تم نسخ الرمز');
  };

  if (!lead) return null;

  const reissueTemplate = getLastRedeemedAccessCode(codes);
  const reissueEnd = reissueTemplate ? getAccessCodeEffectiveEnd(reissueTemplate) : null;
  const reissueRemainingMonths = reissueEnd ? getRemainingSubscriptionMonths(reissueEnd) : null;
  const reissueExpiryLabel = reissueTemplate
    ? formatAccessCodeExpiryLabel(reissueTemplate, { converted: true })
    : null;
  const stalePending = hasStalePendingCodeFlag(lead, codes, { codesFetched: true });
  const usableActive = getUsableActiveAccessCode(codes);
  const blockingActive = getRawActiveAccessCode(codes);
  const showCreateButton = !isConvertedLead(lead);
  const createButtonLabel =
    usableActive || blockingActive ? 'استبدال وإنشاء رمز جديد' : 'إنشاء الرمز';

  const titleByStep: Record<DialogStep, string> = {
    configure: `رمز دخول — ${lead.full_name}`,
    manage: `الرمز الحالي — ${lead.full_name}`,
    verify: `تحقق من الرمز — ${lead.full_name}`,
    deliver: `إرسال الرمز — ${lead.full_name}`,
    reissue: `رمز جديد — ${lead.full_name}`,
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) resetState();
        }}
      >
        <DialogContent
          className="font-arabic max-w-md"
          dir="rtl"
          onInteractOutside={(event) => {
            if (step === 'deliver' && generatedCode) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (step === 'deliver' && generatedCode) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {titleByStep[step]}
            </DialogTitle>
          </DialogHeader>

          {step === 'deliver' && generatedCode && deliverMeta ? (
            <AccessCodeDeliverStep
              lead={lead}
              accessCode={generatedCode}
              meta={deliverMeta}
              replacing={isReplacing}
              onCopy={() => void copyCode()}
              onReplace={() => setConfirmReplaceOpen(true)}
            />
          ) : step === 'reissue' ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                العميل مُفعّل. الرمز الجديد ينتهي مع <strong>تاريخ الاشتراك الأصلي</strong>{' '}
                (باقة 6 أو 12 شهر — لا يُمدَّد حتى لو استُبدل بعد شهر أو أكثر).
              </p>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-emerald-800">
                  الباقة: {selectedPlan?.name ?? planLabelFor(planId)}
                </p>
                <p className="text-muted-foreground">
                  {reissueRemainingMonths
                    ? `${reissueRemainingMonths} ${reissueRemainingMonths === 1 ? 'شهر متبقٍ' : 'أشهر متبقية'}`
                    : planId === 'yearly'
                      ? '12 شهر'
                      : '6 أشهر'}
                  {agreedPrice ? ` · ${Number(agreedPrice).toLocaleString('ar-IQ')} د.ع` : ''}
                </p>
                {reissueExpiryLabel && (
                  <p className="text-xs text-emerald-700">{reissueExpiryLabel}</p>
                )}
              </div>
              <Button
                className="w-full rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isReplacing}
                onClick={() => void handleReissue()}
              >
                <RefreshCw className={cn('h-4 w-4', isReplacing && 'animate-spin')} />
                {isReplacing ? 'جاري إنشاء رمز جديد...' : 'إنشاء رمز جديد للعميل'}
              </Button>
            </div>
          ) : step === 'manage' && activeCode && deliverMeta ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                الرمز الكامل غير متاح في هذه الجلسة. إذا نسي العميل الرمز، أنشئ رمزاً جديداً
                مباشرة — <strong>بدون إدخال الرمز القديم</strong> — بنفس الباقة والمدة والسعر.
              </p>
              <p
                className="text-xl font-bold font-mono tracking-wider text-center text-muted-foreground"
                dir="ltr"
              >
                BDY-****-{activeCode.code_hint}
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الباقة</span>
                  <span className="font-semibold">{planLabelFor(deliverMeta.planId)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">المدة</span>
                  <span className="font-semibold">{deliverMeta.durationMonths} شهر</span>
                </div>
                {deliverMeta.agreedPrice != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">السعر</span>
                    <span className="font-semibold">
                      {deliverMeta.agreedPrice.toLocaleString('ar-IQ')} د.ع
                    </span>
                  </div>
                )}
              </div>
              <Button
                className="w-full rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isReplacing}
                onClick={() => setConfirmReplaceOpen(true)}
              >
                <RefreshCw className={cn('h-4 w-4', isReplacing && 'animate-spin')} />
                {isReplacing ? 'جاري إنشاء رمز جديد...' : 'إنشاء رمز جديد للعميل'}
              </Button>
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-primary underline"
                onClick={() => setStep('verify')}
              >
                لدي الرمز الكامل — تحقق منه فقط (اختياري)
              </button>
            </div>
          ) : step === 'verify' ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                اختياري: أدخل الرمز إذا كان لديك نسخة منه للتحقق قبل الإرسال.
              </p>
              <div className="space-y-1">
                <Label htmlFor="verify-code">رمز التفعيل</Label>
                <Input
                  id="verify-code"
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(formatAccessCodeInput(e.target.value))}
                  placeholder="BDY-XXXX-XXXX"
                  className="rounded-xl text-center font-mono tracking-widest h-12"
                  dir="ltr"
                />
              </div>
              <Button
                className="w-full rounded-xl gap-2"
                disabled={verifying}
                onClick={() => void handleVerify()}
              >
                <ShieldCheck className="h-4 w-4" />
                {verifying ? 'جاري التحقق...' : 'تحقق والمتابعة'}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setStep('manage')}
              >
                رجوع — إنشاء رمز جديد بدون الرمز القديم
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              {stalePending && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed">
                  لا يوجد رمز نشط فعلياً لهذا العميل — يمكنك إنشاء رمز جديد الآن.
                </div>
              )}
              {usableActive && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed">
                  يوجد رمز نشط{' '}
                  <span className="font-mono" dir="ltr">
                    (BDY-****-{usableActive.code_hint})
                  </span>
                  . إنشاء رمز جديد سيستبدله تلقائياً.
                </div>
              )}
              {blockingActive && !usableActive && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed">
                  يوجد رمز قديم غير صالح — سيتم استبداله عند إنشاء رمز جديد.
                </div>
              )}
              <>
                <p className="text-sm text-muted-foreground">
                  {planLockedToLead
                    ? 'الباقة التي اختارها العميل — راجع السعر ثم اضغط إنشاء.'
                    : 'اختر المدة المتفق عليها ثم اضغط إنشاء — رمز واحد نشط لكل عميل.'}
                </p>
                <div className={cn('gap-2', planLockedToLead ? 'grid grid-cols-1' : 'grid grid-cols-2')}>
                  {configurablePlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={planLockedToLead}
                      onClick={() => handlePlanPick(plan.id as PlanId)}
                      className={cn(
                        'rounded-xl border-2 px-3 py-4 text-right transition-all',
                        planId === plan.id || planLockedToLead
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40',
                        planLockedToLead && 'cursor-default'
                      )}
                    >
                      {planLockedToLead && (
                        <p className="text-xs text-primary font-medium mb-1">{plan.name}</p>
                      )}
                      <p className="font-bold">{plan.toggleLabel}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.priceAmount.toLocaleString('ar-IQ')} د.ع
                      </p>
                    </button>
                  ))}
                </div>
                {planLockedToLead && (
                  <p className="text-xs text-muted-foreground">
                    {planLabelForLead(lead)}
                  </p>
                )}
                {!showPrice ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowPrice(true)}
                  >
                    تعديل السعر المتفق عليه
                  </button>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="agreed-price">السعر (د.ع)</Label>
                    <Input
                      id="agreed-price"
                      type="number"
                      value={agreedPrice}
                      onChange={(e) => setAgreedPrice(e.target.value)}
                      className="rounded-xl"
                      dir="ltr"
                    />
                  </div>
                )}
                <a
                  href={buildWhatsAppUrl(lead.whatsapp_number, buildInitialWhatsAppMessage(lead))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 py-2.5 text-sm text-[#128C7E] hover:bg-[#25D366]/10"
                >
                  <MessageCircle className="h-4 w-4" />
                  تواصل مع العميل قبل إنشاء الرمز
                </a>
              </>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {step === 'deliver' ? (
              <Button type="button" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
                تم — أغلق بعد النسخ
              </Button>
            ) : step === 'manage' || step === 'verify' ? (
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                إغلاق
              </Button>
            ) : step === 'reissue' ? (
              <>
                <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                  إغلاق
                </Button>
                <Button
                  className="rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={isReplacing}
                  onClick={() => void handleReissue()}
                >
                  <KeyRound className="h-4 w-4" />
                  {isReplacing ? 'جاري الإنشاء...' : 'إنشاء رمز جديد للعميل'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                {showCreateButton && (
                  <Button
                    className="rounded-xl gap-2"
                    disabled={generating}
                    onClick={() => void handleGenerate()}
                  >
                    <KeyRound className="h-4 w-4" />
                    {generating ? 'جاري الإنشاء...' : createButtonLabel}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent className="font-arabic" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>استبدال رمز الدخول؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-relaxed">
              سيُلغى الرمز الحالي ويُنشأ رمز جديد بنفس الباقة والمدة والسعر المتفق عليه. أرسل
              الرمز الجديد للعميل عبر واتساب.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-amber-600 hover:bg-amber-700"
              onClick={() => void handleReplace()}
            >
              نعم، استبدال الرمز
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GenerateAccessCodeDialog;
