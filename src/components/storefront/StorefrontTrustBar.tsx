import { ShieldCheck, Truck, RotateCcw, BadgeCheck } from "lucide-react";

const items = [
  { icon: BadgeCheck, label: "متجر موثوق" },
  { icon: Truck, label: "توصيل لجميع المحافظات" },
  { icon: ShieldCheck, label: "دفع آمن" },
  { icon: RotateCcw, label: "سياسة إرجاع واضحة" },
];

const StorefrontTrustBar = () => (
  <div className="px-4 py-3">
    <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-full bg-card border border-border/60 text-xs font-medium text-muted-foreground"
        >
          <Icon className="w-3.5 h-3.5 text-primary" />
          {label}
        </div>
      ))}
    </div>
  </div>
);

export default StorefrontTrustBar;
