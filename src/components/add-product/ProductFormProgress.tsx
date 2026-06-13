import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  icon: React.ReactNode;
  completed: boolean;
  required?: boolean;
}

interface ProductFormProgressProps {
  steps: Step[];
  completionPercentage: number;
}

const ProductFormProgress = ({ steps, completionPercentage }: ProductFormProgressProps) => {
  const requiredSteps = steps.filter((s) => s.required !== false);
  const nextStep = requiredSteps.find((s) => !s.completed);

  return (
    <div className="ds-card p-5 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-foreground">جاهزية المنتج</span>
          <span className="text-sm font-bold text-primary">{completionPercentage}%</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {completionPercentage === 100
            ? 'جميع الحقول المطلوبة مكتملة — يمكنك الحفظ الآن'
            : nextStep
              ? `الخطوة التالية: ${nextStep.label}`
              : 'أكمل الحقول المطلوبة للنشر'}
        </p>
      </div>

      <div className="w-full h-2 bg-muted/80 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${completionPercentage}%` }}
          role="progressbar"
          aria-valuenow={completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li
            key={i}
            className={cn(
              'flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 transition-colors',
              step.completed ? 'text-primary' : 'text-muted-foreground',
              !step.completed && step.required !== false && 'bg-warning/5'
            )}
          >
            {step.completed ? (
              <Check className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className={cn('flex-1', step.completed && 'font-medium')}>{step.label}</span>
            {step.required === false ? (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">اختياري</span>
            ) : (
              <span className="text-[10px] text-destructive/80">مطلوب</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductFormProgress;
