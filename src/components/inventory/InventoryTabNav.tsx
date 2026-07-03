import { cn } from '@/lib/utils';

export type InventoryTab = 'overview' | 'movements' | 'analytics' | 'warehouses' | 'orders';

const tabs: { id: InventoryTab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'movements', label: 'الحركات' },
  { id: 'analytics', label: 'التحليلات' },
  { id: 'warehouses', label: 'المستودعات' },
  { id: 'orders', label: 'أوامر الشراء' },
];

interface InventoryTabNavProps {
  active: InventoryTab;
  onChange: (tab: InventoryTab) => void;
}

const InventoryTabNav = ({ active, onChange }: InventoryTabNavProps) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-0.5 px-0.5">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onChange(tab.id)}
        className={cn(
          'shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all min-h-[40px]',
          active === tab.id
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default InventoryTabNav;
