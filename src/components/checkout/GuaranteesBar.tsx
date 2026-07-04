import { Truck, Shield, RotateCcw } from "lucide-react";
import ScrollReveal from "@/components/product-details/ScrollReveal";
import { cn } from "@/lib/utils";

const guarantees = [
  { icon: Truck, label: "توصيل سريع" },
  { icon: Shield, label: "دفع آمن" },
  { icon: RotateCcw, label: "إرجاع سهل" },
];

interface GuaranteesBarProps {
  compact?: boolean;
}

const GuaranteesBar = ({ compact = false }: GuaranteesBarProps) => (
  <ScrollReveal delay={100} animation="slide-up">
    <div
      className={cn(
        "flex justify-around rounded-lg border border-border/50",
        compact ? "py-2 px-3" : "py-3 px-4 rounded-xl"
      )}
    >
      {guarantees.map((g, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={cn("rounded-full bg-primary/10 flex items-center justify-center", compact ? "w-7 h-7" : "w-8 h-8")}>
            <g.icon className={cn("text-primary", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
          </div>
          <span className={cn("text-muted-foreground font-medium", compact ? "text-[9px]" : "text-[10px]")}>
            {g.label}
          </span>
        </div>
      ))}
    </div>
  </ScrollReveal>
);

export default GuaranteesBar;
