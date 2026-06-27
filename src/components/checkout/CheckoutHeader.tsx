import { ShoppingBag } from "lucide-react";
import { RtlHeaderBar } from "@/components/layout/RtlHeaderBar";

interface CheckoutHeaderProps {
  cartCount: number;
  backTo?: string;
}

const CheckoutHeader = ({ cartCount, backTo = "/preview" }: CheckoutHeaderProps) => (
  <div className="sticky top-0 z-40 bg-card border-b border-border/50 font-arabic">
    <div className="w-full py-2.5 px-4 sm:px-5">
      <RtlHeaderBar
        title="إتمام الطلب"
        titleClassName="text-base"
        backTo={backTo}
        backLabel="العودة للمتجر"
        endSlot={
          <div className="relative w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-primary" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in">
                {cartCount}
              </span>
            )}
          </div>
        }
      />
    </div>
  </div>
);

export default CheckoutHeader;
