import { Check } from "lucide-react";

interface Step {
  label: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface ProductFormProgressProps {
  steps: Step[];
  completionPercentage: number;
}

const ProductFormProgress = ({ steps, completionPercentage }: ProductFormProgressProps) => {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">اكتمال البيانات</span>
        <span className="text-sm font-bold text-foreground">{completionPercentage}%</span>
      </div>
      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              step.completed
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step.completed ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              step.icon
            )}
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductFormProgress;
