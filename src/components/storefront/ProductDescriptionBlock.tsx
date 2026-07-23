import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

interface ProductDescriptionBlockProps {
  product: Product;
}

const COLLAPSE_AT = 320;

const ProductDescriptionBlock = ({ product }: ProductDescriptionBlockProps) => {
  const fullDescription = product.description?.trim();
  const [expanded, setExpanded] = useState(false);

  if (!fullDescription) return null;

  const isLong = fullDescription.length > COLLAPSE_AT;
  const shown =
    !isLong || expanded ? fullDescription : `${fullDescription.slice(0, COLLAPSE_AT).trim()}…`;

  return (
    <section className="sf-pdp-open-block">
      <h2 className="sf-pdp-section-title">وصف المنتج</h2>
      <p
        className={cn(
          'text-muted-foreground leading-[1.8] text-sm sm:text-[15px] whitespace-pre-wrap text-right',
          !expanded && isLong && 'line-clamp-6'
        )}
      >
        {shown}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:opacity-80 transition-opacity duration-150"
        >
          {expanded ? 'عرض أقل' : 'قراءة المزيد'}
          <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-180')} />
        </button>
      )}
    </section>
  );
};

export default ProductDescriptionBlock;
