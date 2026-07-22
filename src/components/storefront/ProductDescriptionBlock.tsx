import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
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
    <section className="sf-card overflow-hidden">
      <header className="flex items-center gap-3 px-6 py-5 border-b border-border/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <FileText className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="text-right min-w-0">
          <h2 className="text-lg font-bold text-foreground tracking-tight">وصف المنتج</h2>
          <p className="text-xs text-muted-foreground mt-0.5">تفاصيل كاملة عن المنتج</p>
        </div>
      </header>
      <div className="px-6 py-6">
        <p
          className={cn(
            'text-muted-foreground leading-[1.85] text-sm sm:text-base whitespace-pre-wrap text-right',
            !expanded && isLong && 'line-clamp-6'
          )}
        >
          {shown}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {expanded ? 'عرض أقل' : 'قراءة المزيد'}
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
    </section>
  );
};

export default ProductDescriptionBlock;
