
import { useNavigate } from "react-router-dom";
import { RtlHeaderBar } from "@/components/layout/RtlHeaderBar";

const ProductHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-card p-3 sm:p-4 sticky top-0 z-20 border-b border-border/50 font-arabic">
      <div className="max-w-6xl mx-auto px-1 sm:px-2">
        <RtlHeaderBar
          title="تفاصيل المنتج"
          titleClassName="text-base"
          onBack={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default ProductHeader;
