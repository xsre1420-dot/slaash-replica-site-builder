import { useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Copy, KeyRound, RefreshCw, Send, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { AccessCodeRecord } from '@/types/accessCodes';
import { buildAccessCodeWhatsAppMessage } from '@/types/accessCodes';
import { buildWhatsAppUrl, type LeadRecord } from '@/types/leads';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import { getStoredAccessCodeForLead } from '@/utils/accessCodeSessionStore';
import {
  canCreateAccessCodeForLead,
  canReissueAccessCodeForLead,
  getLastRedeemedAccessCode,
  getRawActiveAccessCode,
  isConvertedLead,
} from '@/utils/leadAccessCodeUtils';
import {
  formatAccessCodeExpiryLabel,
  getRemainingSubscriptionMonths,
  getAccessCodeEffectiveEnd,
} from '@/utils/accessCodeExpiryUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type LeadAccessCodePanelProps = {
  lead: LeadRecord;
  codes: AccessCodeRecord[];
  codesLoading?: boolean;
  replacing?: boolean;
  /** Plaintext shown right after create/replace (same session). */
  revealedAccessCode?: string | null;
  onRefreshCodes?: () => void;
  onManageCode?: () => void;
  onReplaceCode?: () =>
    | Promise<{ accessCode: string; codeId: string } | void>
    | { accessCode: string; codeId: string }
    | void;
  onReissueCode?: () =>
    | Promise<{ accessCode: string; codeId: string } | void>
    | { accessCode: string; codeId: string }
    | void;
};

const planLabel = (planId: string) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.name ??
  (planId === 'yearly' ? 'باقة سنوية' : 'باقة 6 أشهر');

const statusLabel: Record<AccessCodeRecord['status'], string> = {
  active: 'بانتظار التفعيل',
  redeemed: 'مُفعّل',
  expired: 'منتهي',
  revoked: 'ملغى',
};

export const LeadAccessCodePanel = ({
  lead,
  codes,
  codesLoading = false,
  replacing = false,
  revealedAccessCode = null,
  onRefreshCodes,
  onManageCode,
  onReplaceCode,
  onReissueCode,
}: LeadAccessCodePanelProps) => {
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [localRevealedCode, setLocalRevealedCode] = useState<string | null>(null);
  const activeCode = getRawActiveAccessCode(codes);
  const historyCodes = codes.filter((c) => c.status !== 'active');
  const lastRedeemed = getLastRedeemedAccessCode(codes);
  const converted = isConvertedLead(lead);
  const activeExpiryLabel = activeCode
    ? formatAccessCodeExpiryLabel(activeCode, { converted })
    : null;
  const reissueEnd = lastRedeemed ? getAccessCodeEffectiveEnd(lastRedeemed) : null;
  const reissueRemainingMonths = reissueEnd ? getRemainingSubscriptionMonths(reissueEnd) : null;
  const sessionPlaintext =
    activeCode != null ? getStoredAccessCodeForLead(lead.id, activeCode.id) : null;
  const plaintext = revealedAccessCode ?? localRevealedCode ?? sessionPlaintext;
  const showPanel = Boolean(
    activeCode || historyCodes.length > 0 || lead.has_pending_code || converted
  );
  const canManage = Boolean((activeCode || lead.has_pending_code) && onManageCode);
  const canReplace = Boolean((activeCode || lead.has_pending_code) && onReplaceCode);
  const canReissue = Boolean(canReissueAccessCodeForLead(lead, codes) && onReissueCode);

  const copyPlaintext = async () => {
    if (!plaintext) return;
    await navigator.clipboard.writeText(plaintext);
    toast.success('تم نسخ رمز التفعيل');
  };

  const whatsAppResendUrl =
    activeCode && plaintext
      ? buildWhatsAppUrl(
          lead.whatsapp_number,
          buildAccessCodeWhatsAppMessage({
            customerName: lead.full_name,
            accessCode: plaintext,
            planLabel: planLabel(activeCode.plan_id),
            durationMonths: activeCode.duration_months,
            agreedPrice: activeCode.agreed_price,
            loginUrl: `${window.location.origin}/login`,
            subscriptionEndAt: activeCode.subscription_end_at,
            isLoginReissue: converted && Boolean(activeCode.subscription_end_at),
          })
        )
      : null;

  const handleConfirmReplace = async () => {
    setConfirmReplaceOpen(false);
    const result = await onReplaceCode?.();
    if (result?.accessCode) {
      setLocalRevealedCode(result.accessCode);
    }
  };

  const handleReissue = async () => {
    const result = await onReissueCode?.();
    if (result?.accessCode) {
      setLocalRevealedCode(result.accessCode);
    }
  };

  if (!showPanel) {
    return null;
  }

  return (
    <>
      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            رمز الدخول
          </h3>
          {(activeCode || lead.has_pending_code) && (
            <Badge variant="outline" className="text-amber-700 border-amber-500/30">
              {statusLabel.active}
            </Badge>
          )}
          {converted && !activeCode && !lead.has_pending_code && (
            <Badge variant="outline" className="text-emerald-700 border-emerald-500/30">
              اشتراك مُفعّل
            </Badge>
          )}
        </div>

        {canReissue && (
          <div className="rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/[0.05] p-4 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              العميل مُفعّل. إذا نسي رمز الدخول، أنشئ رمزاً جديداً — ينتهي في{' '}
              <strong>نفس تاريخ اشتراكه الأصلي</strong> (6 أو 12 شهراً من التفعيل الأول، لا
              يُمدَّد).
            </p>
            {lastRedeemed ? (
              <div className="rounded-xl border border-primary/15 bg-background/60 px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الباقة</span>
                  <span className="font-medium">{planLabel(lastRedeemed.plan_id)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">المدة</span>
                  <span className="font-medium">
                    {converted && reissueRemainingMonths
                      ? `${reissueRemainingMonths} ${reissueRemainingMonths === 1 ? 'شهر متبقٍ' : 'أشهر متبقية'}`
                      : `${lastRedeemed.duration_months} شهر`}
                  </span>
                </div>
              {reissueEnd && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">بداية الاشتراك</span>
                  <span className="font-medium">
                    {format(
                      new Date(lastRedeemed.subscription_start_at ?? lastRedeemed.created_at),
                      'dd MMM yyyy',
                      { locale: ar }
                    )}
                  </span>
                </div>
              )}
              {reissueEnd && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">ينتهي الاشتراك</span>
                    <span className="font-medium">
                      {format(new Date(reissueEnd), 'dd MMM yyyy', { locale: ar })}
                    </span>
                  </div>
                )}
                {lastRedeemed.agreed_price != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">السعر</span>
                    <span className="font-medium">
                      {lastRedeemed.agreed_price.toLocaleString('ar-IQ')} د.ع
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-primary/15 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                {lead.selected_plan_name
                  ? `الباقة: ${lead.selected_plan_name}`
                  : 'سيُنشأ الرمز بنفس شروط الاشتراك الحالي'}
              </div>
            )}
            <Button
              className="w-full rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={replacing}
              onClick={() => void handleReissue()}
            >
              <RefreshCw className={cn('h-4 w-4', replacing && 'animate-spin')} />
              {replacing ? 'جاري إنشاء رمز جديد...' : 'إنشاء رمز جديد للعميل'}
            </Button>
          </div>
        )}

        {activeCode ? (
          <div className="rounded-2xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-4 space-y-3">
            {plaintext ? (
              <>
                <p className="text-2xl font-bold font-mono tracking-wider text-center" dir="ltr">
                  {plaintext}
                </p>
                <p className="text-xs text-center text-emerald-700 bg-emerald-500/10 rounded-lg px-3 py-2">
                  انسخ الرمز أو أرسله عبر واتساب للعميل الآن — يمكن استبداله لاحقاً بنفس
                  الاشتراك إذا فقده.
                </p>
              </>
            ) : (
              <p
                className="text-xl font-bold font-mono tracking-wider text-center text-muted-foreground"
                dir="ltr"
              >
                BDY-****-{activeCode.code_hint}
              </p>
            )}

            <div className="rounded-xl border border-primary/15 bg-background/60 px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">الباقة</span>
                <span className="font-medium">{planLabel(activeCode.plan_id)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">المدة</span>
                <span className="font-medium">
                  {converted && activeCode.subscription_end_at
                    ? `${activeCode.duration_months} ${activeCode.duration_months === 1 ? 'شهر متبقٍ' : 'أشهر متبقية'}`
                    : `${activeCode.duration_months} شهر`}
                </span>
              </div>
              {activeExpiryLabel && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">صلاحية الرمز</span>
                  <span className="font-medium text-xs text-right">{activeExpiryLabel}</span>
                </div>
              )}
              {activeCode.agreed_price != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">السعر</span>
                  <span className="font-medium">
                    {activeCode.agreed_price.toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>
              )}
            </div>

            {!plaintext && (
              <p className="text-xs text-center text-amber-800/90 bg-amber-500/10 rounded-lg px-3 py-2 leading-relaxed">
                الرمز الكامل غير متاح هنا. إذا نسي العميل الرمز، اضغط «إنشاء رمز جديد» — لا
                حاجة لإدخال الرمز القديم.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {plaintext && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl gap-2"
                    onClick={() => void copyPlaintext()}
                  >
                    <Copy className="h-4 w-4" />
                    نسخ الرمز
                  </Button>
                  {whatsAppResendUrl ? (
                    <a
                      href={whatsAppResendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button className="w-full rounded-xl gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white">
                        <Send className="h-4 w-4" />
                        إرسال واتساب
                      </Button>
                    </a>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {canReplace && (
                <Button
                  className={cn(
                    'flex-1 rounded-xl gap-2',
                    !plaintext && 'bg-amber-600 hover:bg-amber-700 text-white'
                  )}
                  variant={plaintext ? 'outline' : 'default'}
                  disabled={replacing}
                  onClick={() => setConfirmReplaceOpen(true)}
                >
                  <RefreshCw className={cn('h-4 w-4', replacing && 'animate-spin')} />
                  {replacing
                    ? 'جاري إنشاء رمز جديد...'
                    : plaintext
                      ? 'استبدال الرمز'
                      : 'إنشاء رمز جديد للعميل'}
                </Button>
              )}
              {canManage && plaintext && (
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl gap-2"
                  onClick={onManageCode}
                >
                  <Settings2 className="h-4 w-4" />
                  إدارة الرمز
                </Button>
              )}
            </div>
          </div>
        ) : lead.has_pending_code ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {codesLoading
                ? 'جاري تحميل تفاصيل الرمز...'
                : 'يوجد رمز نشط — افتح إدارة الرمز للتحقق أو الاستبدال.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {onRefreshCodes && (
                <Button variant="outline" className="rounded-xl gap-2" onClick={onRefreshCodes}>
                  <RefreshCw className="h-4 w-4" />
                  إعادة تحميل
                </Button>
              )}
              {canManage && (
                <Button className="rounded-xl gap-2" onClick={onManageCode}>
                  <Settings2 className="h-4 w-4" />
                  إدارة الرمز
                </Button>
              )}
              {canReplace && (
                <Button
                  variant="outline"
                  className="rounded-xl gap-2 border-amber-500/40"
                  disabled={replacing}
                  onClick={() => setConfirmReplaceOpen(true)}
                >
                  استبدال الرمز
                </Button>
              )}
            </div>
          </div>
        ) : converted && !canReissue && !activeCode ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive text-center">
            انتهى اشتراك هذا العميل — لا يمكن إنشاء رمز دخول جديد حتى يتم تجديد الاشتراك.
          </div>
        ) : null}

        {historyCodes.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground">سجل الرموز السابقة</p>
            {historyCodes.map((code) => (
              <div
                key={code.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-mono text-muted-foreground" dir="ltr">
                    BDY-****-{code.code_hint}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {statusLabel[code.status]}
                    {code.redeemed_at &&
                      ` · ${format(new Date(code.redeemed_at), 'dd/MM/yyyy', { locale: ar })}`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    code.status === 'redeemed' && 'text-emerald-700 border-emerald-500/30'
                  )}
                >
                  {statusLabel[code.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent className="font-arabic" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>استبدال رمز الدخول؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-relaxed">
              سيُلغى الرمز الحالي تلقائياً ويُنشأ رمز جديد بنفس الباقة والمدة والسعر.{' '}
              <strong>لا تحتاج إدخال الرمز القديم.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-amber-600 hover:bg-amber-700"
              onClick={() => void handleConfirmReplace()}
            >
              نعم، إنشاء رمز جديد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LeadAccessCodePanel;
