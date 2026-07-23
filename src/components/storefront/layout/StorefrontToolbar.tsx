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
    <div className="sf-toolbar-section sf-enter">
      <h2 className="sf-section-title">{sectionTitle}</h2>
      {productCount != null && (
        <p className="sf-section-subtitle">{productCount} منتج</p>
      )}
    </div>

    <div className="sf-toolbar sticky top-[calc(var(--sf-header-h))] z-30 -mx-4 px-4 sm:mx-0 sm:px-0 bg-background/88 backdrop-blur-lg pb-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCycleSort}
          className={cn(
            'sf-pill active:scale-[0.97]',
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

      <div className="sf-segment" role="group" aria-label="طريقة العرض">
        <button
          type="button"
          aria-label="عرض شبكي"
          aria-pressed={viewMode === 'grid'}
          onClick={() => onViewModeChange('grid')}
          className={cn('sf-segment-btn', viewMode === 'grid' && 'sf-segment-btn-active')}
        >
          <Grid3X3 className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="عرض قائمة"
          aria-pressed={viewMode === 'list'}
          onClick={() => onViewModeChange('list')}
          className={cn('sf-segment-btn', viewMode === 'list' && 'sf-segment-btn-active')}
        >
          <List className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  </div>
);

export default StorefrontToolbar;
