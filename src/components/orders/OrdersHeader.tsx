
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RtlHeaderBar } from "@/components/layout/RtlHeaderBar";

const OrdersHeader = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-4 font-arabic">
      <RtlHeaderBar
        title="إدارة الطلبات"
        titleClassName="text-2xl font-bold"
        startSlot={
          <Link to="/builder" aria-label="رجوع">
            <Button variant="ghost" className="p-2 hover:bg-muted rounded-xl min-h-[44px] min-w-[44px]">
              <ArrowRight className="w-6 h-6" />
            </Button>
          </Link>
        }
      />
    </div>
  );
};

export default OrdersHeader;
