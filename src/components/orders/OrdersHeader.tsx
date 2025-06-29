
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const OrdersHeader = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
      <div className="flex justify-between items-center">
        <Link to="/builder">
          <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">إدارة الطلبات</h1>
        <div className="w-10"></div>
      </div>
    </div>
  );
};

export default OrdersHeader;
