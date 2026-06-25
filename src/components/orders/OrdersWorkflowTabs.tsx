import { cn } from '@/lib/utils';
import { OrderWorkflowTab, WORKFLOW_TABS } from '@/utils/orderWorkflowUtils';
import type { WorkflowTabCounts } from '@/types/orders';

interface OrdersWorkflowTabsProps {
  tabCounts: WorkflowTabCounts;
  activeTab: OrderWorkflowTab;
  onTabChange: (tab: OrderWorkflowTab) => void;
}

const OrdersWorkflowTabs = ({ tabCounts, activeTab, onTabChange }: OrdersWorkflowTabsProps) => {
  return (
    <div className="relative min-w-0 w-full overflow-hidden" dir="rtl">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-background to-transparent" />
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory overscroll-x-contain">
        {WORKFLOW_TABS.map((tab) => {
          const count = tabCounts[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all border min-h-[40px] sm:min-h-[44px] shrink-0 snap-start',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/15'
                  : 'bg-card text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground'
              )}
            >
              <span className="whitespace-nowrap">{tab.label}</span>
              <span
                className={cn(
                  'inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
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
};

export default OrdersWorkflowTabs;
