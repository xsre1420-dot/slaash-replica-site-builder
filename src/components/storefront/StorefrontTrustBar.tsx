import { ShieldCheck, Truck, RotateCcw, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { icon: BadgeCheck, label: "متجر موثوق" },
  { icon: Truck, label: "توصيل سريع" },
  { icon: ShieldCheck, label: "دفع آمن" },
  { icon: RotateCcw, label: "إرجاع سهل" },
];

interface StorefrontTrustBarProps {
  compact?: boolean;
  fullWidth?: boolean;
}

/** Compact inline trust strip — prefer StorefrontBenefits on the home page. */
const StorefrontTrustBar = ({ compact = false, fullWidth = false }: StorefrontTrustBarProps) => (
  <div
    className={cn(
      "w-full border-b border-border/40 bg-muted/20",
      fullWidth ? "px-4 sm:px-6" : "",
      compact ? "py-2.5" : "py-3"
    )}
  >
    <div
      className={cn(
        "sf-container flex gap-3 overflow-x-auto scrollbar-hide",
        fullWidth && "max-w-none"
      )}
    >
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full bg-card border border-border/40 px-3 py-2 text-xs font-medium text-muted-foreground",
            compact ? "text-[10px] py-1.5" : "text-xs"
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <span className="font-semibold text-foreground/80 whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default StorefrontTrustBar;
