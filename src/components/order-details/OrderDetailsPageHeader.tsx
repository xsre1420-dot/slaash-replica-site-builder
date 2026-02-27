import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderDetailsPageHeaderProps {
  orderId: string;
}

const OrderDetailsPageHeader = ({ orderId }: OrderDetailsPageHeaderProps) => {
  return (
    <div className="bg-card shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <Link to="/orders">
            <Button variant="ghost" className="p-2 hover:bg-muted rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">تفاصيل الطلب #{orderId}</h1>
          <div className="w-10"></div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsPageHeader;
