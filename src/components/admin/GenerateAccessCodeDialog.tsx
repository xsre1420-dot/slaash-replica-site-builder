import { useEffect, useMemo, useState } from 'react';
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
  replaceLeadAccessCode,
  verifyLeadAccessCode,
} from '@/services/leadAdminService';
import {
  ACCESS_CODE_ERROR_MESSAGES,
  formatAccessCodeInput,
  type AccessCodeRecord,
} from '@/types/accessCodes';
import type { LeadRecord } from '@/types/leads';
import { buildWhatsAppUrl } from '@/types/leads';
import { buildInitialWhatsAppMessage } from '@/utils/leadWorkflowUtils';
import { canCreateAccessCodeForLead } from '@/utils/leadAccessCodeUtils';
import { getStoredAccessCodeForLead, saveGeneratedAccessCode } from '@/utils/accessCodeSessionStore';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const planLabelFor = (planId: string) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.name ??
  (planId === 'yearly' ? 'باقة سنوية' : 'باقة 6 أشهر');

type PlanId = 'annual' | 'yearly';
type DialogStep = 'configure' | 'manage' | 'verify' | 'deliver';

const defaultPlanForLead = (lead: LeadRecord): PlanId =>
  lead.selected_plan_id === 'yearly' ? 'yearly' : 'annual';

const defaultPriceForPlan = (planId: PlanId) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.priceAmount ?? 125_000;

type GenerateAccessCodeDialogProps = {
  lead: LeadRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (payload: { accessCode: string; codeId: string }) => void;
  activeCode?: AccessCodeRecord | null;
  initialStep?: DialogStep;
  /** Open directly on deliver step with a freshly created/replaced code. */
  initialDeliver?: {
    accessCode: string;
    codeId: string;
    meta: AccessCodeDeliverMeta;
  } | null;
};

export const GenerateAccessCodeDialog = ({
  lead,
  open,
  onOpenChange,
  onGenerated,
  activeCode = null,
  initialStep,
  initialDeliver = null,
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
  const [verifyInput, setVerifyInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  const resetState = () => {
    setStep('configure');
    setGeneratedCode(null);
    setCodeId(null);
    setDeliverMeta(null);
    setVerifyInput('');
    setShowPrice(false);
  };

  useEffect(() => {
    if (!lead || !open) return;

    if (initialDeliver) {
      setStep('deliver');
      setGeneratedCode(initialDeliver.accessCode);
      setCodeId(initialDeliver.codeId);
      setDeliverMeta(initialDeliver.meta);
      setVerifyInput('');
      return;
    }

    const stored =
      activeCode != null ? getStoredAccessCodeForLead(lead.id, activeCode.id) : null;

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
      });
    } else if (activeCode) {
      setStep('manage');
      setCodeId(activeCode.id);
      setDeliverMeta({
        planId: activeCode.plan_id,
        durationMonths: activeCode.duration_months,
        agreedPrice: activeCode.agreed_price,
      });
      setGeneratedCode(null);
    } else {
      setStep('configure');
    }

    const plan = defaultPlanForLead(lead);
    setPlanId(plan);
    setAgreedPrice(String(defaultPriceForPlan(plan)));
    setVerifyInput('');
  }, [lead, open, activeCode, initialStep, initialDeliver]);

  const selectedPlan = useMemo(
    () => PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId),
    [planId]
  );

  const handlePlanPick = (next: PlanId) => {
    setPlanId(next);
    setAgreedPrice(String(defaultPriceForPlan(next)));
  };

  const persistCode = (leadId: string, nextCodeId: string, accessCode: string) => {
    saveGeneratedAccessCode({
      leadId,
      codeId: nextCodeId,
      accessCode,
      createdAt: new Date().toISOString(),
    });
    onGenerated?.({ accessCode, codeId: nextCodeId });
  };

  const goDeliver = (
    accessCode: string,
    nextCodeId: string,
    meta: AccessCodeDeliverMeta
  ) => {
    setGeneratedCode(accessCode);
    setCodeId(nextCodeId);
    setDeliverMeta(meta);
    setStep('deliver');
  };

  const handleGenerate = async () => {
    if (!lead) return;
    if (!canCreateAccessCodeForLead(lead)) {
      toast.info('يوجد رمز نشط لهذا العميل — استخدم «إدارة الرمز» للاستبدال');
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
      persistCode(lead.id, result.codeId, result.accessCode);
      goDeliver(result.accessCode, result.codeId, {
        planId: result.planId,
        durationMonths: result.durationMonths,
        agreedPrice: result.agreedPrice,
      });
      toast.success('تم إنشاء الرمز');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'generate_failed';
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
      goDeliver(verifyInput.trim(), verified.codeId, {
        planId: verified.planId,
        durationMonths: verified.durationMonths,
        agreedPrice: verified.agreedPrice,
      });
      persistCode(lead.id, verified.codeId, verifyInput.trim());
      toast.success('الرمز صحيح — نفس شروط الاشتراك');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid_code';
      toast.error(ACCESS_CODE_ERROR_MESSAGES[msg] || 'الرمز غير صحيح لهذا العميل');
    } finally {
      setVerifying(false);
    }
  };

  const handleReplace = async () => {
    if (!lead) return;
    setConfirmReplaceOpen(false);
    setReplacing(true);
    try {
      const result = await replaceLeadAccessCode(lead.id, {
        codeId: codeId ?? activeCode?.id,
        reason: 'replaced-by-admin: same subscription terms',
      });
      persistCode(lead.id, result.codeId, result.accessCode);
      goDeliver(result.accessCode, result.codeId, {
        planId: result.planId,
        durationMonths: result.durationMonths,
        agreedPrice: result.agreedPrice,
      });
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
    await navigator.clipboard.writeText(generatedCode);
    toast.success('تم نسخ الرمز');
  };

  if (!lead) return null;

  const titleByStep: Record<DialogStep, string> = {
    configure: `رمز دخول — ${lead.full_name}`,
    manage: `الرمز الحالي — ${lead.full_name}`,
    verify: `تحقق من الرمز — ${lead.full_name}`,
    deliver: `إرسال الرمز — ${lead.full_name}`,
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
        <DialogContent className="font-arabic max-w-md" dir="rtl">
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
              replacing={replacing}
              onCopy={() => void copyCode()}
              onReplace={() => setConfirmReplaceOpen(true)}
            />
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
                disabled={replacing}
                onClick={() => setConfirmReplaceOpen(true)}
              >
                <RefreshCw className={cn('h-4 w-4', replacing && 'animate-spin')} />
                {replacing ? 'جاري إنشاء رمز جديد...' : 'إنشاء رمز جديد للعميل'}
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
              {lead.has_pending_code ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  يوجد رمز نشط —{' '}
                  <button
                    type="button"
                    className="text-primary font-medium underline"
                    onClick={() => setStep('manage')}
                  >
                    إنشاء رمز جديد للعميل
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    اختر المدة المتفق عليها ثم اضغط إنشاء — رمز واحد لكل عميل.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => handlePlanPick(plan.id as PlanId)}
                        className={cn(
                          'rounded-xl border-2 px-3 py-4 text-right transition-all',
                          planId === plan.id
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        <p className="font-bold">{plan.toggleLabel}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.priceAmount.toLocaleString('ar-IQ')} د.ع
                        </p>
                      </button>
                    ))}
                  </div>
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
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {step === 'deliver' ? (
              <Button className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
                تم
              </Button>
            ) : step === 'manage' || step === 'verify' ? (
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                إغلاق
              </Button>
            ) : (
              <>
                <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                {!lead.has_pending_code && (
                  <Button
                    className="rounded-xl gap-2"
                    disabled={generating}
                    onClick={() => void handleGenerate()}
                  >
                    <KeyRound className="h-4 w-4" />
                    {generating ? 'جاري الإنشاء...' : 'إنشاء الرمز'}
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
