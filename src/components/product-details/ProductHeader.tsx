
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const ProductHeader = () => {
  return (
    <div className="bg-primary text-white p-4 sticky top-0 z-10 shadow-md">
      <div className="flex justify-between items-center">
        <Link to="/preview">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">تفاصيل المنتج</h1>
        <div className="w-6"></div>
      </div>
    </div>
  );
};

export default ProductHeader;
