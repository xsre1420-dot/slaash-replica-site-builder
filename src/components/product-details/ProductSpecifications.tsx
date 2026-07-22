import { Tag, Barcode, Layers, Truck } from 'lucide-react';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

interface ProductSpecificationsProps {
  product: Product;
  className?: string;
}

const SpecRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border/30 last:border-0">
    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Icon className="w-4 h-4 text-primary/70" strokeWidth={2} />
    </div>
    <span className="text-sm text-muted-foreground tabular-nums text-left" dir="ltr">
      {value}
    </span>
  </div>
);

const ProductSpecifications = ({ product, className }: ProductSpecificationsProps) => {
  const rows: { icon: typeof Tag; label: string; value: string }[] = [];

  if (product.brand?.trim()) rows.push({ icon: Tag, label: 'العلامة', value: product.brand.trim() });
  if (product.category?.trim()) rows.push({ icon: Layers, label: 'الفئة', value: product.category.trim() });
  if (product.productClassification?.trim()) {
    rows.push({ icon: Layers, label: 'التصنيف', value: product.productClassification.trim() });
  }
  if (product.sku?.trim()) rows.push({ icon: Barcode, label: 'SKU', value: product.sku.trim() });
  if (product.barcode?.trim()) rows.push({ icon: Barcode, label: 'الباركود', value: product.barcode.trim() });
  if (product.freeShipping) rows.push({ icon: Truck, label: 'الشحن', value: 'مجاني' });

  if (rows.length === 0) return null;

  return (
    <section className={cn('sf-card p-5 sm:p-6', className)}>
      <h2 className="sf-section-title text-lg mb-4">المواصفات</h2>
      <div dir="rtl">{rows.map((row) => <SpecRow key={row.label} {...row} />)}</div>
    </section>
  );
};

export default ProductSpecifications;
