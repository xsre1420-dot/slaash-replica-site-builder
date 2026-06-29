import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageCircle,
  User,
  Phone,
  CheckCircle2,
  ArrowRight,
  Crown,
  MapPin,
  Instagram,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { AuthPageHeader, AuthTextField } from '@/components/auth/AuthFormFields';
import { authSubmitClass } from '@/components/auth/authFormStyles';
import { submitAccessLead, LeadSubmitError } from '@/services/leadAdminService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ElitePricingCard from '@/components/landing/ElitePricingCard';
import {
  formatPlanPriceLabel,
  getPublicPlanById,
} from '@/data/subscriptionPlans';
import { IRAQ_GOVERNORATES, MONTHLY_ORDER_OPTIONS } from '@/data/leadFormOptions';
import { cn } from '@/lib/utils';

const RequestAccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialPlanId = searchParams.get('plan');
  const validInitialPlan = getPublicPlanById(initialPlanId);

  const [step, setStep] = useState<'plan' | 'details'>(() =>
    validInitialPlan ? 'details' : 'plan'
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    () => validInitialPlan?.id ?? null
  );
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [expectedMonthlyOrders, setExpectedMonthlyOrders] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedPlan = useMemo(
    () => getPublicPlanById(selectedPlanId),
    [selectedPlanId]
  );

  useEffect(() => {
    if (step === 'details' && !getPublicPlanById(selectedPlanId)) {
      setStep('plan');
      setSelectedPlanId(null);
    }
  }, [step, selectedPlanId]);

  const handlePlanSelect = (planId: string) => {
    if (!getPublicPlanById(planId)) return;
    setSelectedPlanId(planId);
    setStep('details');
    navigate(`/request-access?plan=${planId}`, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !getPublicPlanById(selectedPlanId)) {
      setError('يرجى اختيار الباقة أولاً');
      setStep('plan');
      return;
    }
    if (!governorate) {
      setError('يرجى اختيار المحافظة');
      return;
    }
    if (!expectedMonthlyOrders) {
      setError('يرجى تحديد عدد الطلبات الشهرية المتوقع');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await submitAccessLead({
        fullName,
        whatsappNumber: whatsapp,
        selectedPlanId,
        governorate,
        expectedMonthlyOrders,
        instagramUrl: instagramUrl || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof LeadSubmitError ? err.message : 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageShell wide>
        <div className="py-8 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-arabic">تم استلام طلبك!</h1>
            <p className="mx-auto max-w-md font-arabic leading-relaxed text-muted-foreground">
              {selectedPlan ? (
                <>
                  سنتواصل معك عبر واتساب قريباً لتأكيد{' '}
                  <span className="font-semibold text-foreground">
                    {selectedPlan.name} ({selectedPlan.toggleLabel})
                  </span>{' '}
                  — {formatPlanPriceLabel(selectedPlan)} — وإكمال تفعيل متجرك.
                </>
              ) : (
                'سيتواصل معك فريقنا عبر واتساب قريباً.'
              )}
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" className="rounded-xl font-arabic">
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  if (step === 'plan') {
    return (
      <AuthPageShell form>
        <div className="mb-2 flex items-center justify-center gap-3 text-sm">
          <StepDot active label="اختر المدة" />
          <div className="h-px w-8 bg-border" />
          <StepDot label="بياناتك" />
        </div>

        <AuthPageHeader
          title="اختر مدّة اشتراكك"
          subtitle="باقة واحدة شاملة — حدّد المدة المناسبة، ثم أكمِل بياناتك وسنتواصل معك"
        />

        <div className="relative flex justify-center py-2">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-primary/[0.04] to-transparent" />
          <ElitePricingCard
            selectedPlanId={selectedPlanId}
            defaultPlanId={validInitialPlan?.id ?? 'annual'}
            onSelect={handlePlanSelect}
          />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground font-arabic">
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell form>
      <div className="mb-6 flex items-center justify-center gap-3 text-sm">
        <StepDot done label="الباقة" />
        <div className="h-px w-10 bg-primary" />
        <StepDot active label="بياناتك" />
      </div>

      <AuthPageHeader
        title="أكمل طلبك"
        subtitle="أخبرنا عنك ومشروعك — سنتواصل معك عبر واتساب لإتمام التفعيل"
      />

      {selectedPlan && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/90 shadow-sm">
                <Crown className="h-5 w-5 text-amber-950" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">الباقة المختارة</p>
                <p className="text-lg font-bold text-foreground">
                  {selectedPlan.name} — {selectedPlan.toggleLabel}
                </p>
                <p className="text-sm font-semibold text-primary">
                  {formatPlanPriceLabel(selectedPlan)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-xl text-muted-foreground"
              onClick={() => setStep('plan')}
            >
              تغيير
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6"
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-semibold text-foreground">معلومات التواصل</legend>

          <AuthTextField
            id="fullName"
            label="الاسم الكامل"
            value={fullName}
            onChange={setFullName}
            placeholder="مثال: أحمد محمد"
            icon={User}
            required
          />

          <AuthTextField
            id="whatsapp"
            label="رقم واتساب"
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="07XXXXXXXXX"
            icon={Phone}
            dir="ltr"
            required
          />

          <div className="space-y-2">
            <Label htmlFor="governorate" className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              المحافظة <span className="text-destructive">*</span>
            </Label>
            <Select value={governorate} onValueChange={setGovernorate} required>
              <SelectTrigger id="governorate" className="h-11 rounded-xl">
                <SelectValue placeholder="اختر محافظتك" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {IRAQ_GOVERNORATES.map((gov) => (
                  <SelectItem key={gov} value={gov}>
                    {gov}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <div className="border-t border-border/50" />

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-semibold text-foreground">عن مشروعك</legend>

          <AuthTextField
            id="instagram"
            label="حساب إنستغرام للمشروع (اختياري)"
            value={instagramUrl}
            onChange={setInstagramUrl}
            placeholder="@username أو رابط الحساب"
            icon={Instagram}
            dir="ltr"
            hint="يساعدنا على فهم نشاطك التجاري بشكل أفضل"
          />

          <div className="space-y-2">
            <Label htmlFor="monthlyOrders" className="flex items-center gap-1.5 text-sm font-medium">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              الطلبات الشهرية الحالية أو المتوقعة <span className="text-destructive">*</span>
            </Label>
            <Select value={expectedMonthlyOrders} onValueChange={setExpectedMonthlyOrders} required>
              <SelectTrigger id="monthlyOrders" className="h-11 rounded-xl">
                <SelectValue placeholder="اختر النطاق المناسب" />
              </SelectTrigger>
              <SelectContent>
                {MONTHLY_ORDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <MessageCircle className="ml-1 inline h-3.5 w-3.5" />
          سنتواصل معك على واتساب خلال ساعات العمل لتأكيد الباقة وإرشادك لخطوات التفعيل.
        </p>

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2 rounded-xl"
            onClick={() => setStep('plan')}
          >
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
          <Button type="submit" disabled={loading} className={cn(authSubmitClass, 'flex-[1.4]')}>
            {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground font-arabic">
        لديك حساب بالفعل؟{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </AuthPageShell>
  );
};

const StepDot = ({
  label,
  active = false,
  done = false,
}: {
  label: string;
  active?: boolean;
  done?: boolean;
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
        done && 'bg-primary/15 text-primary',
        active && 'bg-primary text-primary-foreground',
        !done && !active && 'bg-muted text-muted-foreground'
      )}
    >
      {done ? '✓' : active ? '2' : '1'}
    </div>
    <span className={cn('text-xs font-medium', active || done ? 'text-foreground' : 'text-muted-foreground')}>
      {label}
    </span>
  </div>
);

export default RequestAccess;
