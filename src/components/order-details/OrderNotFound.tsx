import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const OrderNotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">الطلب غير موجود</h2>
        <Link to="/orders">
          <Button 
            className="mt-4 text-primary-foreground border-0 rounded-2xl bg-primary hover:bg-primary/90"
          >
            العودة للطلبات
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default OrderNotFound;
