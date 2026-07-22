import { ArrowUpDown, Grid3X3, List } from 'lucide-react';
import StoreFilterDrawer from '@/components/store/StoreFilterDrawer';
import { cn } from '@/lib/utils';

interface StorefrontToolbarProps {
  sortLabel: string;
  sortActive: boolean;
  onCycleSort: () => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  maxPrice: number;
  filterPriceRange: [number, number];
  availableSizes: string[];
  filterSizes: string[];
  onFilterApply: (range: [number, number], sizes: string[]) => void;
  onFilterReset: () => void;
  activeFilterCount: number;
  productCount?: number;
  sectionTitle?: string;
}

const StorefrontToolbar = ({
  sortLabel,
  sortActive,
  onCycleSort,
  viewMode,
  onViewModeChange,
  maxPrice,
  filterPriceRange,
  availableSizes,
  filterSizes,
  onFilterApply,
  onFilterReset,
  activeFilterCount,
  productCount,
  sectionTitle = 'المنتجات',
}: StorefrontToolbarProps) => (
  <div className="sf-container">
    <div className="text-center py-6 sm:py-8 border-b border-border/30 mb-4">
      <h2 className="sf-section-title">{sectionTitle}</h2>
      {productCount != null && (
        <p className="sf-section-subtitle">{productCount} منتج</p>
      )}
    </div>

    <div className="sf-toolbar sticky top-[calc(var(--sf-header-h))] z-30 -mx-4 px-4 sm:mx-0 sm:px-0 bg-background/92 backdrop-blur-md pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCycleSort}
          className={cn(
            'sf-pill',
            sortActive ? 'sf-pill-active' : 'sf-pill-inactive'
          )}
        >
          <ArrowUpDown className="w-3.5 h-3.5" strokeWidth={2.25} />
          {sortLabel}
        </button>
        <StoreFilterDrawer
          maxPrice={maxPrice}
          currentRange={filterPriceRange}
          availableSizes={availableSizes}
          selectedSizes={filterSizes}
          onApply={onFilterApply}
          onReset={onFilterReset}
          activeFilterCount={activeFilterCount}
        />
      </div>

      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/40">
        <button
          type="button"
          aria-label="عرض شبكي"
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'p-2 rounded-md transition-all duration-200',
            viewMode === 'grid' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Grid3X3 className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="عرض قائمة"
          onClick={() => onViewModeChange('list')}
          className={cn(
            'p-2 rounded-md transition-all duration-200',
            viewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  </div>
);

export default StorefrontToolbar;
