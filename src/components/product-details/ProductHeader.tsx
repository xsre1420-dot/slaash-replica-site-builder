import { useNavigate } from 'react-router-dom';
import { RtlHeaderBar } from '@/components/layout/RtlHeaderBar';

const ProductHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5">
        <RtlHeaderBar
          title="تفاصيل المنتج"
          titleClassName="text-sm font-bold"
          onBack={() => navigate(-1)}
        />
      </div>
    </header>
  );
};

export default ProductHeader;
