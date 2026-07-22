import { ShieldCheck, Truck, RotateCcw, BadgeCheck, Banknote, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const trustItems = [
  { icon: Truck, label: 'توصيل سريع' },
  { icon: Banknote, label: 'الدفع عند الاستلام' },
  { icon: RotateCcw, label: 'إرجاع سهل' },
  { icon: ShieldCheck, label: 'دفع آمن' },
  { icon: BadgeCheck, label: 'منتج أصلي' },
  { icon: Package, label: 'تغليف آمن' },
];

interface ProductTrustStripProps {
  className?: string;
}

const ProductTrustStrip = ({ className }: ProductTrustStripProps) => (
  <div
    className={cn(
      'grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl border border-border/40 bg-muted/20 p-4',
      className
    )}
  >
    {trustItems.map(({ icon: Icon, label }) => (
      <div key={label} className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
      </div>
    ))}
  </div>
);

export default ProductTrustStrip;
