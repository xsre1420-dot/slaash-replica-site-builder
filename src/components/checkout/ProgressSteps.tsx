import { ShoppingBag, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
}

const steps = [
  { icon: ShoppingBag, label: "السلة" },
  { icon: MapPin, label: "التوصيل" },
  { icon: Check, label: "التأكيد" },
];

const ProgressSteps = ({ currentStep }: ProgressStepsProps) => (
  <div className="flex items-center justify-center gap-0 py-4 px-6" dir="rtl">
    {steps.map((step, index) => {
      const Icon = step.icon;
      const isActive = index <= currentStep;
      const isCompleted = index < currentStep;
      return (
        <div key={index} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500",
                isCompleted
                  ? "bg-primary text-primary-foreground scale-100"
                  : isActive
                  ? "bg-primary/20 text-primary ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 animate-scale-in" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
            </div>
            <span className={cn(
              "text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              "w-12 h-0.5 mx-1 mb-4 rounded-full transition-all duration-500",
              isCompleted ? "bg-primary" : "bg-border"
            )} />
          )}
        </div>
      );
    })}
  </div>
);

export default ProgressSteps;
