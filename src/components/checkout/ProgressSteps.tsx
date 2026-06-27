import { Fragment } from "react";
import { ShoppingBag, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
  fullWidth?: boolean;
}

const steps = [
  { icon: ShoppingBag, label: "السلة" },
  { icon: MapPin, label: "التوصيل" },
  { icon: Check, label: "التأكيد" },
];

const ProgressSteps = ({ currentStep, fullWidth = false }: ProgressStepsProps) => (
  <div
    className={cn(
      "w-full",
      fullWidth
        ? "border-b border-border/40 bg-card/40 px-3 py-2.5 sm:px-4"
        : "flex items-center justify-center gap-0 px-2 py-2.5"
    )}
    dir="rtl"
  >
    <div className={cn("flex w-full items-start", !fullWidth && "w-auto justify-center")}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index <= currentStep;
        const isCompleted = index < currentStep;

        return (
          <Fragment key={step.label}>
            <div
              className={cn(
                "flex shrink-0 flex-col items-center gap-1",
                fullWidth ? "w-[4.5rem] sm:w-20" : "gap-0.5"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-500",
                  fullWidth ? "h-9 w-9 sm:h-10 sm:w-10" : "h-8 w-8",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "border-2 border-primary bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className={cn("animate-scale-in", fullWidth ? "h-4 w-4" : "h-3.5 w-3.5")} />
                ) : (
                  <Icon className={fullWidth ? "h-4 w-4" : "h-3.5 w-3.5"} />
                )}
              </div>
              <span
                className={cn(
                  "font-medium transition-colors",
                  fullWidth ? "text-[11px] sm:text-xs" : "text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "rounded-full transition-all duration-500",
                  fullWidth
                    ? "mx-0.5 mt-[18px] h-0.5 flex-1 sm:mx-1 sm:mt-5"
                    : "mx-1 mb-3.5 h-0.5 w-10 sm:w-12",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  </div>
);

export default ProgressSteps;
