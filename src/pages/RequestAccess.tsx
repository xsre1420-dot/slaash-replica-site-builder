import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  User,
  Phone,
  ArrowRight,
  MapPin,
  Instagram,
  BarChart3,
  ArrowLeft,
  Loader2,
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
import { submitAccessLead, LeadSubmitError } from '@/services/leadAdminService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SubscriptionStepProgress from '@/components/subscription/SubscriptionStepProgress';
import SubscriptionPlanPicker from '@/components/subscription/SubscriptionPlanPicker';
import SubscriptionPlanSummaryCard from '@/components/subscription/SubscriptionPlanSummaryCard';
import SubscriptionRequestSuccess from '@/components/subscription/SubscriptionRequestSuccess';
import SubscriptionTrustStrip from '@/components/subscription/SubscriptionTrustStrip';
import { getPublicPlanById } from '@/data/subscriptionPlans';
import { IRAQ_GOVERNORATES, MONTHLY_ORDER_OPTIONS } from '@/data/leadFormOptions';

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
  const submitLockRef = useRef(false);

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
  };

  const handleContinueToDetails = () => {
    if (!selectedPlanId || !getPublicPlanById(selectedPlanId)) {
      setError('يرجى اختيار الباقة أولاً');
      return;
    }
    setError(null);
    setStep('details');
    navigate(`/request-access?plan=${selectedPlanId}`, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    if (!selectedPlanId || !getPublicPlanById(selectedPlanId)) {
      setError('يرجى اختيار الباقة أولاً');
      setStep('plan');
      return;
    }
    if (!fullName.trim()) {
      setError('يرجى إدخال الاسم الكامل');
      return;
    }
    if (!whatsapp.trim()) {
      setError('يرجى إدخال رقم واتساب');
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
    submitLockRef.current = true;
    try {
      await submitAccessLead({
        fullName: fullName.trim(),
        whatsappNumber: whatsapp.trim(),
        selectedPlanId,
        governorate,
        expectedMonthlyOrders,
        instagramUrl: instagramUrl.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof LeadSubmitError ? err.message : 'حدث خطأ، حاول مرة أخرى');
      submitLockRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageShell wide>
        <SubscriptionRequestSuccess plan={selectedPlan} />
      </AuthPageShell>
    );
  }

  if (step === 'plan') {
    return (
      <AuthPageShell wide>
        <SubscriptionStepProgress current="plan" />

        <AuthPageHeader
          title="اختر باقة اشتراكك"
          subtitle="باقة واحدة شاملة — حدّد المدة المناسبة ثم أكمِل بياناتك وسنتواصل معك"
        />

        {error && (
          <Alert variant="destructive" className="mb-4 rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <SubscriptionPlanPicker
          selectedPlanId={selectedPlanId}
          onSelect={handlePlanSelect}
        />

        <Button
          type="button"
          size="lg"
          className="sub-cta-primary"
          disabled={!selectedPlanId}
          onClick={handleContinueToDetails}
        >
          متابعة — أكمل بياناتك
          <ArrowLeft className="mr-1 h-4 w-4" />
        </Button>

        <SubscriptionTrustStrip />

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
      <SubscriptionStepProgress current="details" />

      <AuthPageHeader
        title="أكمل طلب الاشتراك"
        subtitle="أخبرنا عنك ومشروعك — سنتواصل معك عبر واتساب لإتمام التفعيل"
      />

      <div className="sub-request-layout">
        <aside className="sub-request-layout__aside hidden lg:block">
          {selectedPlan && (
            <SubscriptionPlanSummaryCard
              plan={selectedPlan}
              onChangePlan={() => setStep('plan')}
            />
          )}
          <SubscriptionTrustStrip />
        </aside>

        <div>
          {selectedPlan && (
            <div className="mb-4 lg:hidden">
              <SubscriptionPlanSummaryCard
                plan={selectedPlan}
                onChangePlan={() => setStep('plan')}
                compact
              />
            </div>
          )}

          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            onSubmit={handleSubmit}
            className="sub-form-panel space-y-6"
          >
            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <fieldset className="space-y-4">
              <legend className="sub-form-panel__section-title w-full">معلومات التواصل</legend>

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
                hint="سنتواصل معك على هذا الرقم"
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

            <fieldset className="space-y-4">
              <legend className="sub-form-panel__section-title w-full">عن مشروعك</legend>

              <AuthTextField
                id="instagram"
                label="حساب إنستغرام (اختياري)"
                value={instagramUrl}
                onChange={setInstagramUrl}
                placeholder="@username أو رابط الحساب"
                icon={Instagram}
                dir="ltr"
                hint="يساعدنا على فهم نشاطك التجاري"
              />

              <div className="space-y-2">
                <Label htmlFor="monthlyOrders" className="flex items-center gap-1.5 text-sm font-medium">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  الطلبات الشهرية المتوقعة <span className="text-destructive">*</span>
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

            <p className="sub-form-panel__notice">
              <MessageCircle className="ml-1 inline h-3.5 w-3.5 text-primary" />
              سنتواصل معك على واتساب خلال ساعات العمل لتأكيد الباقة وإرشادك لخطوات التفعيل.
            </p>

            <div className="sub-form-panel__actions">
              <Button
                type="button"
                variant="outline"
                className="sub-form-panel__back gap-2"
                onClick={() => setStep('plan')}
                disabled={loading}
              >
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Button>
              <Button type="submit" disabled={loading} className="sub-form-panel__submit">
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  'إرسال طلب الاشتراك'
                )}
              </Button>
            </div>
          </motion.form>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground font-arabic">
        لديك حساب بالفعل؟{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </AuthPageShell>
  );
};

export default RequestAccess;
