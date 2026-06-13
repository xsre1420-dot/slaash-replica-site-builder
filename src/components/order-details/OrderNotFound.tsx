import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

const OrderNotFound = () => {
  return (
    <div className="ds-card p-8 sm:p-12 text-center max-w-md mx-auto">
      <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-2xl flex items-center justify-center">
        <ShoppingBag className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">الطلب غير موجود</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        قد يكون الطلب محذوفاً أو الرابط غير صحيح. تحقق من قائمة الطلبات.
      </p>
      <Link to="/orders">
        <Button className="rounded-xl min-h-[44px]">
          العودة للطلبات
        </Button>
      </Link>
    </div>
  );
};

export default OrderNotFound;
