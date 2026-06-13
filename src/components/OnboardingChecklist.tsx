import { useState, useEffect } from 'react';
import { Check, Rocket, Package, Settings, Share2, ArrowLeft, Sparkles, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link?: string;
  buttonLabel: string;
  action?: 'copy-link';
}

const steps: OnboardingStep[] = [
  {
    id: 'add-product',
    title: 'أضف أول منتج',
    description: 'ابدأ بإضافة منتجك الأول — صورة، اسم، سعر',
    icon: Package,
    link: '/add-product',
    buttonLabel: 'إضافة منتج',
  },
  {
    id: 'settings',
    title: 'خصّص متجرك',
    description: 'أضف الشعار وغيّر الألوان وأسعار التوصيل',
    icon: Settings,
    link: '/settings',
    buttonLabel: 'الإعدادات',
  },
  {
    id: 'share',
    title: 'شارك متجرك',
    description: 'انسخ رابط متجرك وشاركه مع عملائك على واتساب',
    icon: Share2,
    buttonLabel: 'نسخ الرابط',
    action: 'copy-link',
  },
];

interface OnboardingChecklistProps {
  completedSteps?: string[];
  onDismiss: () => void;
  onCopyLink?: () => void;
}

const OnboardingChecklist = ({ completedSteps = [], onDismiss, onCopyLink }: OnboardingChecklistProps) => {
  const progress = Math.round((completedSteps.length / steps.length) * 100);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const welcomed = localStorage.getItem('onboarding_welcomed');
    if (!welcomed && completedSteps.length === 0) {
      setShowWelcome(true);
      localStorage.setItem('onboarding_welcomed', 'true');
    }
  }, [completedSteps.length]);

  if (completedSteps.length >= steps.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="ds-card-elevated p-5 sm:p-6 mb-6"
    >
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 sm:p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">متجرك جاهز!</h3>
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                تم إنشاء متجرك تلقائياً. أكمل 3 خطوات بسيطة لتبدأ البيع.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-muted-foreground"
                onClick={() => setShowWelcome(false)}
              >
                فهمت، لنبدأ
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-foreground text-sm">دليل البداية</h3>
            <p className="text-[11px] text-muted-foreground">3 خطوات للانطلاق</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] px-2"
          aria-label="تخطي دليل الإعداد"
        >
          تخطي
        </button>
      </div>

      <div className="w-full bg-muted/80 rounded-full h-1.5 mb-2 overflow-hidden">
        <motion.div
          className="bg-primary h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">{completedSteps.length} من {steps.length} خطوات مكتملة</p>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl transition-all duration-200 ${
                isCompleted ? 'bg-accent/50' : 'bg-muted/30 hover:bg-muted/50 hover:shadow-soft'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {isCompleted ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!isCompleted && step.action === 'copy-link' && onCopyLink && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs h-9 px-3 shrink-0"
                  onClick={onCopyLink}
                >
                  <Copy className="w-3 h-3 ml-1" />
                  {step.buttonLabel}
                </Button>
              )}
              {!isCompleted && step.link && (
                <Link to={step.link}>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs h-9 px-3 shrink-0">
                    {step.buttonLabel}
                    <ArrowLeft className="w-3 h-3 mr-1" />
                  </Button>
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default OnboardingChecklist;
