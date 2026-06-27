import { Package, Eye, FileEdit, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PRODUCT_LIFECYCLE_TABS,
  type ProductLifecycleCounts,
} from '@/utils/productCatalogPageUtils';
import type { ProductLifecycleFilter } from '@/lib/productLifecycle';

const TAB_ICONS: Record<ProductLifecycleFilter, typeof Package> = {
  all: Package,
  published: Eye,
  draft: FileEdit,
  archived: Archive,
};

/** Flat blue active tab — no glow, no white overlay badges */
const ACTIVE_TAB =
  'bg-blue-600 text-white border-blue-600 hover:bg-blue-600 hover:text-white';
const ACTIVE_BADGE = 'bg-blue-700 text-white border border-blue-800/30';
const IDLE_TAB =
  'bg-background text-muted-foreground border-border/50 hover:border-blue-300 hover:text-foreground';

interface ProductsWorkflowTabsProps {
  tabCounts: ProductLifecycleCounts;
  activeTab: ProductLifecycleFilter;
  onTabChange: (tab: ProductLifecycleFilter) => void;
  className?: string;
}

const ProductsWorkflowTabs = ({
  tabCounts,
  activeTab,
  onTabChange,
  className,
}: ProductsWorkflowTabsProps) => (
  <div className={cn('relative min-w-0 w-full', className)} dir="rtl">
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card to-transparent" />
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent" />
    <div
      className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-none snap-x snap-mandatory overscroll-x-contain"
      role="tablist"
      aria-label="تصفية حسب حالة المنتج"
    >
      {PRODUCT_LIFECYCLE_TABS.map((tab) => {
        const count = tabCounts[tab.id] ?? 0;
        const isActive = activeTab === tab.id;
        const Icon = TAB_ICONS[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors border min-h-[40px] shrink-0 snap-start',
              isActive ? ACTIVE_TAB : IDLE_TAB
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" strokeWidth={2} />
            <span className="whitespace-nowrap">{tab.label}</span>
            <span
              className={cn(
                'inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums',
                isActive ? ACTIVE_BADGE : 'bg-muted text-muted-foreground'
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

export default ProductsWorkflowTabs;
