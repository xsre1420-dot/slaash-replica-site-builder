import { Truck, Shield, RotateCcw } from "lucide-react";
import ScrollReveal from "@/components/product-details/ScrollReveal";

const guarantees = [
  { icon: Truck, label: "توصيل سريع" },
  { icon: Shield, label: "دفع آمن" },
  { icon: RotateCcw, label: "إرجاع سهل" },
];

const GuaranteesBar = () => (
  <ScrollReveal delay={100} animation="slide-up">
    <div className="flex justify-around py-3 px-4 bg-muted/40 rounded-xl border border-border/50">
      {guarantees.map((g, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <g.icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">{g.label}</span>
        </div>
      ))}
    </div>
  </ScrollReveal>
);

export default GuaranteesBar;
