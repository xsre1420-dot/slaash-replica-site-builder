import { Copy, KeyRound, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildAccessCodeWhatsAppMessage } from '@/types/accessCodes';
import { buildWhatsAppUrl, type LeadRecord } from '@/types/leads';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import { cn } from '@/lib/utils';

export type AccessCodeDeliverMeta = {
  planId: string;
  durationMonths: number;
  agreedPrice: number | null;
};

type AccessCodeDeliverStepProps = {
  lead: LeadRecord;
  accessCode: string;
  meta: AccessCodeDeliverMeta;
  replacing?: boolean;
  onCopy: () => void;
  onReplace: () => void;
  subtitle?: string;
};

const planLabelFor = (planId: string) =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.name ??
  (planId === 'yearly' ? 'باقة سنوية' : 'باقة 6 أشهر');

export const AccessCodeDeliverStep = ({
  lead,
  accessCode,
  meta,
  replacing = false,
  onCopy,
  onReplace,
  subtitle,
}: AccessCodeDeliverStepProps) => {
  const planLabel = planLabelFor(meta.planId);
  const whatsAppUrl = buildWhatsAppUrl(
    lead.whatsapp_number,
    buildAccessCodeWhatsAppMessage({
      customerName: lead.full_name,
      accessCode,
      planLabel,
      durationMonths: meta.durationMonths,
      agreedPrice: meta.agreedPrice,
      loginUrl: `${window.location.origin}/login`,
    })
  );

  return (
    <div className="space-y-4 py-1">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">الباقة</span>
          <span className="font-semibold">{planLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">المدة</span>
          <span className="font-semibold">{meta.durationMonths} شهر</span>
        </div>
        {meta.agreedPrice != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">السعر المتفق عليه</span>
            <span className="font-semibold">{meta.agreedPrice.toLocaleString('ar-IQ')} د.ع</span>
          </div>
        )}
        <Badge variant="outline" className="mt-1 text-[10px] text-emerald-700 border-emerald-500/30">
          نفس شروط الاشتراك — يُحافظ عليها عند الاستبدال
        </Badge>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground mb-2">رمز التفعيل</p>
        <p className="text-2xl font-bold font-mono tracking-wider" dir="ltr">
          {accessCode}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={onCopy}>
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

      <Button
        variant="outline"
        className="w-full rounded-xl gap-2 border-amber-500/40 text-amber-800 hover:bg-amber-500/10"
        disabled={replacing}
        onClick={onReplace}
      >
        <RefreshCw className={cn('h-4 w-4', replacing && 'animate-spin')} />
        {replacing ? 'جاري استبدال الرمز...' : 'استبدال الرمز (رمز جديد — نفس الاشتراك)'}
      </Button>

      <p className="text-xs text-center text-muted-foreground leading-relaxed">
        {subtitle ?? 'العميل يدخل من /login — يتحقق من الرمز ثم يُفعَّل حسابه بنفس مدة الاشتراك.'}
      </p>
    </div>
  );
};

export default AccessCodeDeliverStep;
