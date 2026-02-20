import { useState } from 'react';
import { Check, Rocket, Package, Settings, Share2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
  buttonLabel: string;
}

const steps: OnboardingStep[] = [
  {
    id: 'add-product',
    title: 'أضف أول منتج',
    description: 'ابدأ بإضافة منتجك الأول مع صورة ووصف وسعر',
    icon: Package,
    link: '/add-product',
    buttonLabel: 'إضافة منتج',
  },
  {
    id: 'settings',
    title: 'أكمل إعدادات المتجر',
    description: 'أضف اسم المتجر والشعار وأسعار التوصيل',
    icon: Settings,
    link: '/settings',
    buttonLabel: 'الإعدادات',
  },
  {
    id: 'share',
    title: 'شارك متجرك',
    description: 'انسخ رابط متجرك وشاركه مع عملائك',
    icon: Share2,
    link: '/preview',
    buttonLabel: 'معاينة وشارك',
  },
];

interface OnboardingChecklistProps {
  completedSteps?: string[];
  onDismiss: () => void;
}

const OnboardingChecklist = ({ completedSteps = [], onDismiss }: OnboardingChecklistProps) => {
  const progress = Math.round((completedSteps.length / steps.length) * 100);

  if (completedSteps.length >= steps.length) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground text-sm">أكمل إعداد متجرك</h3>
        </div>
        <button onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground">
          تخطي
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">{completedSteps.length} من {steps.length} خطوات مكتملة</p>

      <div className="space-y-3">
        {steps.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          return (
            <div 
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                isCompleted ? 'bg-accent/50' : 'bg-muted/30 hover:bg-muted/50'
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
              {!isCompleted && (
                <Link to={step.link}>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs h-8 px-3">
                    {step.buttonLabel}
                    <ArrowLeft className="w-3 h-3 mr-1" />
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
