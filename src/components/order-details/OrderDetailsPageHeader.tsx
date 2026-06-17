import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RtlHeaderBar } from "@/components/layout/RtlHeaderBar";

interface OrderDetailsPageHeaderProps {
  orderId: string;
}

const OrderDetailsPageHeader = ({ orderId }: OrderDetailsPageHeaderProps) => {
  return (
    <div className="bg-card shadow-sm font-arabic">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <RtlHeaderBar
          title={`تفاصيل الطلب #${orderId}`}
          titleClassName="text-2xl font-semibold"
          startSlot={
            <Link to="/orders" aria-label="رجوع">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted min-h-[44px] min-w-[44px]">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
};

export default OrderDetailsPageHeader;
