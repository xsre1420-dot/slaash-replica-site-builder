import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryInsight, InventoryProductRow } from '@/utils/inventoryPageUtils';

interface InventoryInsightsPanelProps {
  insights: InventoryInsight[];
  productsById: Map<string, InventoryProductRow>;
  onSelectProduct: (product: InventoryProductRow) => void;
  onFocusInsight: (insight: InventoryInsight) => void;
  activeInsightId?: string | null;
}

const InventoryInsightsPanel = ({
  insights,
  productsById,
  onSelectProduct,
  onFocusInsight,
  activeInsightId,
}: InventoryInsightsPanelProps) => {
  if (insights.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 justify-end px-0.5">
        <h2 className="text-sm font-semibold text-foreground">رؤى المخزون</h2>
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-0.5 px-0.5">
        {insights.map((insight) => {
          const first = productsById.get(insight.productIds[0]);
          const active = activeInsightId === insight.id;
          return (
            <button
              key={insight.id}
              type="button"
              onClick={() => onFocusInsight(insight)}
              className={cn(
                'shrink-0 w-[min(100%,220px)] rounded-2xl border p-3.5 text-right transition-all',
                'hover:border-primary/25 hover:shadow-md',
                active
                  ? 'border-primary/40 ring-2 ring-primary/15 bg-primary/[0.03]'
                  : 'border-border/50 bg-card shadow-sm'
              )}
            >
              <p className="text-xs font-semibold text-foreground mb-1">{insight.title}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{insight.description}</p>
              {first && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProduct(first);
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  فتح {first.name.slice(0, 24)}
                  {first.name.length > 24 ? '…' : ''}
                </button>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default InventoryInsightsPanel;
