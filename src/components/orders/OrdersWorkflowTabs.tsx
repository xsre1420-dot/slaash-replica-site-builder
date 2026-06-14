import { cn } from '@/lib/utils';
import { OrderWorkflowTab, WORKFLOW_TABS, countOrdersByWorkflowTab } from '@/utils/orderWorkflowUtils';
import { Order } from '@/types';

interface OrdersWorkflowTabsProps {
  orders: Order[];
  activeTab: OrderWorkflowTab;
  onTabChange: (tab: OrderWorkflowTab) => void;
}

const OrdersWorkflowTabs = ({ orders, activeTab, onTabChange }: OrdersWorkflowTabsProps) => {
  const counts = countOrdersByWorkflowTab(orders);

  return (
    <div className="overflow-x-auto pb-1 -mx-1 px-1">
      <div className="flex gap-2 min-w-max">
        {WORKFLOW_TABS.map((tab) => {
          const count = counts[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all border min-h-[44px]',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'inline-flex min-w-[1.5rem] h-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold',
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
