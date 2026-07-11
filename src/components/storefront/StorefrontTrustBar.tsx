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
      "w-full bg-white border-b border-gray-100",
      fullWidth ? "px-4 sm:px-6" : "px-3",
      compact ? "py-2.5" : "py-3"
    )}
  >
    <div
      className={cn(
        fullWidth
          ? "grid w-full grid-cols-4 gap-2 sm:gap-3 md:max-w-2xl md:mx-auto"
          : "flex gap-2 overflow-x-auto scrollbar-hide max-w-3xl mx-auto"
      )}
    >
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className={cn(
            "flex min-w-0 items-center justify-center gap-1.5 font-medium text-gray-600",
            fullWidth
              ? "flex-col px-0.5 py-1 text-center text-[9px] leading-tight sm:text-[10px]"
              : cn(
                  "shrink-0 rounded-full bg-[#F9FAFB] px-2.5 py-1.5 text-[10px]",
                  compact ? "" : "px-3 py-2 text-xs"
                )
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-primary/12",
              fullWidth ? "h-7 w-7 sm:h-8 sm:w-8" : compact ? "h-6 w-6" : "h-7 w-7"
            )}
          >
            <Icon
              className={cn(
                "shrink-0 text-primary",
                fullWidth ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : compact ? "h-3 w-3" : "h-3.5 w-3.5"
              )}
              strokeWidth={2.25}
            />
          </div>
          <span className={cn("font-semibold text-gray-700", fullWidth ? "line-clamp-2" : undefined)}>{label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default StorefrontTrustBar;
