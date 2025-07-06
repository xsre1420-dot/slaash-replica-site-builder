import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const OrderNotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800">الطلب غير موجود</h2>
        <Link to="/orders">
          <Button 
            className="mt-4 text-white border-0 rounded-2xl"
            style={{ 
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
            }}
          >
            العودة للطلبات
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default OrderNotFound;