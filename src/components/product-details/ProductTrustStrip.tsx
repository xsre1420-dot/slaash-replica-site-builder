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
  style?: React.CSSProperties;
}

const ProductTrustStrip = ({ className, style }: ProductTrustStripProps) => (
  <div
    className={cn(
      'flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-border/25',
      className
    )}
    style={style}
  >
    {trustItems.map(({ icon: Icon, label }) => (
      <span key={label} className="sf-pdp-trust-item">
        <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" strokeWidth={2} />
        {label}
      </span>
    ))}
  </div>
);

export default ProductTrustStrip;
