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
        "flex justify-around py-4",
        compact ? "px-2" : "px-4"
      )}
    >
      {guarantees.map((g, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className={cn("rounded-full bg-primary/12 flex items-center justify-center", compact ? "w-8 h-8" : "w-9 h-9")}>
            <g.icon className={cn("text-primary", compact ? "w-3.5 h-3.5" : "w-4 h-4")} strokeWidth={2.25} />
          </div>
          <span className={cn("text-gray-500 font-semibold", compact ? "text-[9px]" : "text-[10px]")}>
            {g.label}
          </span>
        </div>
      ))}
    </div>
  </ScrollReveal>
);

export default GuaranteesBar;
