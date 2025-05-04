
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const OrdersHeader = () => {
  return (
    <div className="bg-red-600 text-white p-4">
      <div className="flex justify-between items-center">
        <Link to="/builder">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">إدارة الطلبات</h1>
        <div className="w-6"></div> {/* Empty div for alignment */}
      </div>
    </div>
  );
};

export default OrdersHeader;
