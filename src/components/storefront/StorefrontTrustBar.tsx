import { ShieldCheck, Truck, RotateCcw, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { icon: BadgeCheck, label: "متجر موثوق" },
  { icon: Truck, label: "توصيل لجميع المحافظات" },
  { icon: ShieldCheck, label: "دفع آمن" },
  { icon: RotateCcw, label: "سياسة إرجاع واضحة" },
];

interface StorefrontTrustBarProps {
  compact?: boolean;
  fullWidth?: boolean;
}

const StorefrontTrustBar = ({ compact = false, fullWidth = false }: StorefrontTrustBarProps) => (
  <div
    className={cn(
      "w-full border-b border-border/40 bg-background",
      fullWidth ? "px-3 sm:px-4" : "px-3",
      compact ? "py-2" : "py-3 sm:px-4"
    )}
  >
    <div
      className={cn(
        fullWidth
          ? "grid w-full grid-cols-4 gap-1 sm:gap-1.5"
          : "flex gap-1.5 overflow-x-auto scrollbar-hide max-w-3xl mx-auto"
      )}
    >
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className={cn(
            "flex min-w-0 items-center justify-center gap-1 font-medium text-muted-foreground",
            fullWidth
              ? "flex-col px-0.5 py-1 text-center text-[9px] leading-tight sm:text-[10px]"
              : cn(
                  "shrink-0 rounded-full border border-border/60 bg-card",
                  compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-2 text-xs"
                )
          )}
        >
          <Icon
            className={cn(
              "shrink-0 text-primary",
              fullWidth ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : compact ? "h-3 w-3" : "h-3.5 w-3.5"
            )}
          />
          <span className={fullWidth ? "line-clamp-2" : undefined}>{label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default StorefrontTrustBar;
