import { Link } from 'react-router-dom';
import {
  PackagePlus,
  Download,
  Upload,
  Plus,
  Package,
  ScanLine,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InventoryQuickActionsProps {
  onExport: () => void;
  onReceiveStock: () => void;
  lowStockCount: number;
  onCycleCount?: () => void;
  onBarcodeScan?: () => void;
  onTransfer?: () => void;
  onPurchaseOrder?: () => void;
  className?: string;
}

const InventoryQuickActions = ({
  onExport,
  onReceiveStock,
  lowStockCount,
  onCycleCount,
  onBarcodeScan,
  onTransfer,
  onPurchaseOrder,
  className,
}: InventoryQuickActionsProps) => {
  const actions = [
    { id: 'add', label: 'إضافة منتج', icon: Plus, primary: true, href: '/add-product' },
    { id: 'receive', label: 'استلام مخزون', icon: PackagePlus, onClick: onReceiveStock, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { id: 'po', label: 'أمر شراء', icon: ShoppingCart, onClick: onPurchaseOrder },
    { id: 'export', label: 'تصدير', icon: Download, onClick: onExport },
    { id: 'import', label: 'استيراد', icon: Upload, href: '/products' },
    { id: 'count', label: 'جرد', icon: ClipboardList, onClick: onCycleCount },
    { id: 'scan', label: 'باركود', icon: ScanLine, onClick: onBarcodeScan },
    { id: 'transfer', label: 'نقل', icon: Package, onClick: onTransfer },
  ] as const;

  return (
    <div className={cn('rounded-2xl border border-border/50 bg-card p-3 sm:p-4 shadow-sm', className)}>
      <p className="text-[11px] font-semibold text-muted-foreground mb-2.5 px-0.5 text-right">
        إجراءات سريعة · <span className="font-normal">/ للبحث · R للتعبئة</span>
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide -mx-0.5 px-0.5">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{action.label}</span>
              {'badge' in action && action.badge != null && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {action.badge}
                </span>
              )}
            </>
          );
          const btnClass = cn(
            'rounded-xl h-10 gap-1.5 shrink-0 text-xs font-semibold px-3.5',
            'primary' in action && action.primary && 'shadow-sm'
          );
          if ('href' in action && action.href) {
            return (
              <Button key={action.id} asChild size="sm" variant={'primary' in action && action.primary ? 'default' : 'outline'} className={btnClass}>
                <Link to={action.href}>{content}</Link>
              </Button>
            );
          }
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={'primary' in action && action.primary ? 'default' : 'outline'}
              className={btnClass}
              onClick={'onClick' in action ? action.onClick : undefined}
            >
              {content}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default InventoryQuickActions;
