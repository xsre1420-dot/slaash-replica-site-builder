import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';

const ProductHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="sf-header">
      <div className="sf-container flex items-center justify-between h-14 sm:h-16">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="sf-icon-btn"
          aria-label="رجوع"
        >
          <ArrowRight className="w-5 h-5" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShoppingBag className="w-4 h-4 text-primary" strokeWidth={2} />
          تفاصيل المنتج
        </div>
        <div className="w-11" aria-hidden />
      </div>
    </header>
  );
};

export default ProductHeader;
