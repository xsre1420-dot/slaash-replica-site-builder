import { memo, useCallback, useMemo, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import { Product } from '@/types';
import ProductCard from '@/components/store/ProductCard';
import ProductSkeleton from '@/components/store/ProductSkeleton';
import StoreEmptyState from '@/components/store/StoreEmptyState';
import { useCartActions, useCartState } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { getProductPath } from '@/lib/storefrontPaths';

export interface StoreProductGridProps {
  products: Product[];
  viewMode: 'grid' | 'list';
  isLoading: boolean;
  searchQuery: string;
  visibleCount: number;
  totalCount: number;
  isTenantMode: boolean;
  storeSlug?: string;
  onAddToCart: (product: Product) => void;
  onShare: (product: Product) => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

const StoreProductGrid = memo(function StoreProductGrid({
  products,
  viewMode,
  isLoading,
  searchQuery,
  visibleCount,
  totalCount,
  isTenantMode,
  storeSlug,
  onAddToCart,
  onShare,
  sentinelRef,
}: StoreProductGridProps) {
  const { cartItems } = useCartState();
  const { updateQuantity } = useCartActions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const cartQuantityById = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach((i) => {
      map.set(i.product.id, (map.get(i.product.id) ?? 0) + i.quantity);
    });
    return map;
  }, [cartItems]);

  const handleViewProduct = useCallback(
    (productId: string) => {
      const previewProduct = products.find((p) => p.id === productId);
      navigate(getProductPath(productId, storeSlug ?? null), {
        state: previewProduct ? { previewProduct } : undefined,
      });
    },
    [products, storeSlug, navigate]
  );

  const handleUpdateQuantity = useCallback(
    (productId: string, qty: number) => {
      const lines = cartItems.filter((i) => i.product.id === productId);
      const simpleLine = lines.find((i) => !i.selectedSize && !i.selectedColor);
      if (!simpleLine) {
        handleViewProduct(productId);
        toast({
          title: 'افتح صفحة المنتج',
          description: 'لتعديل الكمية أو الخيارات (مقاس/لون)',
        });
        return;
      }
      updateQuantity(productId, qty, simpleLine.selectedSize, simpleLine.selectedColor);
    },
    [cartItems, updateQuantity, handleViewProduct, toast]
  );

  const visibleProducts = products.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className={viewMode === 'grid' ? 'sf-product-grid' : 'sf-product-list'} aria-busy="true" aria-label="جاري تحميل المنتجات">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} viewMode={viewMode} index={i} />
        ))}
      </div>
    );
  }

  if (visibleProducts.length === 0) {
    return (
      <StoreEmptyState
        icon={<PackageSearch className="w-8 h-8" strokeWidth={1.75} />}
        title={searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات'}
        description={
          searchQuery
            ? 'جرّب كلمات بحث مختلفة أو امسح الفلاتر'
            : 'تصفح الأقسام الأخرى أو عد لاحقاً'
        }
      />
    );
  }

  return (
    <>
      <div className={viewMode === 'grid' ? 'sf-product-grid' : 'sf-product-list'}>
        {visibleProducts.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            viewMode={viewMode}
            cartQuantity={cartQuantityById.get(product.id) ?? 0}
            onAddToCart={onAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onView={handleViewProduct}
            onShare={onShare}
            index={i}
          />
        ))}
      </div>
      {visibleCount < totalCount && (
        <div ref={sentinelRef} className="sf-load-more" aria-live="polite">
          <div className="flex gap-1.5" aria-hidden>
            <span className="sf-load-dot" />
            <span className="sf-load-dot" />
            <span className="sf-load-dot" />
          </div>
          <p className="text-xs text-muted-foreground">جاري تحميل المزيد...</p>
        </div>
      )}
    </>
  );
});

export default StoreProductGrid;
