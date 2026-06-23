import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, MessageCircle, Send } from 'lucide-react';
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
import { generateAccessCode } from '@/services/leadAdminService';
import {
  ACCESS_CODE_ERROR_MESSAGES,
  buildAccessCodeWhatsAppMessage,
} from '@/types/accessCodes';
import type { LeadRecord } from '@/types/leads';
import { buildWhatsAppUrl } from '@/types/leads';
import { buildInitialWhatsAppMessage } from '@/utils/leadWorkflowUtils';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlanId = 'annual' | 'yearly';

const defaultPlanForLead = (lead: LeadRecord): PlanId =>
  lead.selected_plan_id === 'yearly' ? 'yearly' : 'annual';

const defaultPriceForPlan = (planId: PlanId) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.priceAmount ?? 125_000;

type GenerateAccessCodeDialogProps = {
  lead: LeadRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
};

export const GenerateAccessCodeDialog = ({
  lead,
  open,
  onOpenChange,
  onGenerated,
}: GenerateAccessCodeDialogProps) => {
  const [planId, setPlanId] = useState<PlanId>('annual');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [showPrice, setShowPrice] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!lead || !open) return;
    const plan = defaultPlanForLead(lead);
    setPlanId(plan);
    setAgreedPrice(String(defaultPriceForPlan(plan)));
    setShowPrice(false);
    setGeneratedCode(null);
  }, [lead, open]);

  const selectedPlan = useMemo(
    () => PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId),
    [planId]
  );

  const handlePlanPick = (next: PlanId) => {
    setPlanId(next);
    setAgreedPrice(String(defaultPriceForPlan(next)));
  };

  const handleGenerate = async () => {
    if (!lead) return;
    setGenerating(true);
    try {
      const result = await generateAccessCode({
        leadId: lead.id,
        planId,
        agreedPrice: agreedPrice ? Number(agreedPrice) : defaultPriceForPlan(planId),
        storeName: lead.full_name,
      });
      setGeneratedCode(result.accessCode);
      onGenerated?.();
      toast.success('تم إنشاء الرمز');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'generate_failed';
      toast.error(ACCESS_CODE_ERROR_MESSAGES[msg] || 'تعذر إنشاء الرمز');
    } finally {
      setGenerating(false);
    }
  };

  const whatsAppUrl = useMemo(() => {
    if (!lead || !generatedCode) return '#';
    return buildWhatsAppUrl(
      lead.whatsapp_number,
      buildAccessCodeWhatsAppMessage({
        customerName: lead.full_name,
        accessCode: generatedCode,
        planLabel: selectedPlan?.name ?? 'باقة النخبة',
        durationMonths: selectedPlan?.intervalMonths ?? 6,
        agreedPrice: agreedPrice ? Number(agreedPrice) : selectedPlan?.priceAmount,
        loginUrl: `${window.location.origin}/login`,
      })
    );
  }, [lead, generatedCode, selectedPlan, agreedPrice]);

  const copyCode = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    toast.success('تم نسخ الرمز');
  };

  if (!lead) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setGeneratedCode(null);
      }}
    >
      <DialogContent className="font-arabic max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {generatedCode ? 'أرسل الرمز للعميل' : `رمز دخول — ${lead.full_name}`}
          </DialogTitle>
        </DialogHeader>

        {generatedCode ? (
          <div className="space-y-4 py-1">
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground mb-2">رمز التفعيل</p>
              <p className="text-2xl font-bold font-mono tracking-wider" dir="ltr">
                {generatedCode}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={() => void copyCode()}>
                <Copy className="h-4 w-4" />
                نسخ
              </Button>
              <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full rounded-xl gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white">
                  <Send className="h-4 w-4" />
                  واتساب
                </Button>
              </a>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              العميل يدخل من /login ويلصق الرمز
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              اختر المدة المتفق عليها ثم اضغط إنشاء — سيتولّد الرمز تلقائياً.
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
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {generatedCode ? (
            <Button className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
              تم
            </Button>
          ) : (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button className="rounded-xl gap-2" disabled={generating} onClick={() => void handleGenerate()}>
                <KeyRound className="h-4 w-4" />
                {generating ? 'جاري الإنشاء...' : 'إنشاء الرمز'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateAccessCodeDialog;
