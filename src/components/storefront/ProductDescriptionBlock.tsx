import { FileText } from 'lucide-react';

import type { Product } from '@/types';

interface ProductDescriptionBlockProps {
  product: Product;
}

const ProductDescriptionBlock = ({ product }: ProductDescriptionBlockProps) => {
  const fullDescription = product.description?.trim();

  if (!fullDescription) return null;

  return (
    <section className="rounded-2xl overflow-hidden border border-border/10 shadow-sm">
      <header className="flex items-center gap-2.5 px-5 py-4 sm:px-6 sm:py-5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground tracking-tight">الوصف التفصيلي</h2>
      </header>
      <div className="px-5 pb-6 sm:px-6 sm:pb-7 pt-0">
        <p className="text-muted-foreground leading-[1.75] text-sm sm:text-base whitespace-pre-wrap text-right">
          {fullDescription}
        </p>
      </div>
    </section>
  );
};

export default ProductDescriptionBlock;
