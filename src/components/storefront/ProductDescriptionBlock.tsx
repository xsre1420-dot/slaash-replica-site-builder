import { FileText, Tag } from 'lucide-react';

import type { Product } from '@/types';



interface ProductDescriptionBlockProps {

  product: Product;

}



const ProductDescriptionBlock = ({ product }: ProductDescriptionBlockProps) => {

  const fullDescription = product.description?.trim();

  const hasSpecs = (product.tags?.length ?? 0) > 0 || product.sku || product.category;



  if (!fullDescription && !hasSpecs) return null;



  return (

    <div className="space-y-5">

      {fullDescription && (

        <section className="rounded-2xl overflow-hidden border border-border/10 shadow-sm">

          <header className="flex items-center gap-2.5 px-5 py-4 sm:px-6 sm:py-5">

            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">

              <FileText className="w-4 h-4 text-primary" />

            </div>

            <h2 className="text-lg font-bold text-foreground tracking-tight">وصف المنتج</h2>

          </header>

          <div className="px-5 pb-6 sm:px-6 sm:pb-7 pt-0">

            <p className="text-muted-foreground leading-[1.75] text-sm sm:text-base whitespace-pre-wrap text-right">

              {fullDescription}

            </p>

          </div>

        </section>

      )}



      {hasSpecs && (

        <section className="rounded-2xl overflow-hidden border border-border/10 shadow-sm">

          <header className="flex items-center gap-2.5 px-5 py-4 sm:px-6 sm:py-5">

            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">

              <Tag className="w-4 h-4 text-primary" />

            </div>

            <h2 className="text-lg font-bold text-foreground tracking-tight">المواصفات</h2>

          </header>

          <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-0 divide-y divide-border/10">

            {product.sku && (

              <div className="flex items-center justify-between gap-3 text-sm py-3 first:pt-0">

                <span className="font-mono text-foreground tabular-nums text-xs" dir="ltr">{product.sku}</span>

                <span className="text-muted-foreground text-xs">رمز المنتج</span>

              </div>

            )}

            {product.category && (

              <div className="flex items-center justify-between gap-3 text-sm py-3">

                <span className="text-foreground font-medium">{product.category}</span>

                <span className="text-muted-foreground text-xs">الفئة</span>

              </div>

            )}

            {product.tags?.map((tag) => (

              <div key={tag} className="flex items-center justify-between gap-3 text-sm py-3">

                <span className="text-foreground">{tag}</span>

                <span className="text-muted-foreground text-xs">وسم</span>

              </div>

            ))}

          </div>

        </section>

      )}

    </div>

  );

};



export default ProductDescriptionBlock;

