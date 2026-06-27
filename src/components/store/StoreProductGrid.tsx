import { memo, useCallback, useMemo, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '@/types';
import ProductCard from '@/components/store/ProductCard';
import ProductSkeleton from '@/components/store/ProductSkeleton';
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
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
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
  isFavorite,
  onToggleFavorite,
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
      navigate(getProductPath(productId, isTenantMode ? storeSlug : null), {
        state: previewProduct ? { previewProduct } : undefined,
      });
    },
    [products, isTenantMode, storeSlug, navigate]
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
      <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-3'}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductSkeleton key={i} viewMode={viewMode} />
        ))}
      </div>
    );
  }

  if (visibleProducts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center text-3xl">
          🛍️
        </div>
        <h3 className="text-lg font-bold mb-1 text-foreground">
          {searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات'}
        </h3>
        <p className="text-muted-foreground text-sm">
          {searchQuery ? 'جرب كلمات بحث مختلفة' : 'تصفح الأقسام الأخرى'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-3'}>
        {visibleProducts.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            viewMode={viewMode}
            isFavorite={isFavorite(product.id)}
            cartQuantity={cartQuantityById.get(product.id) ?? 0}
            onToggleFavorite={onToggleFavorite}
            onAddToCart={onAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onView={handleViewProduct}
            onShare={onShare}
            index={i}
          />
        ))}
      </div>
      {visibleCount < totalCount && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
});

export default StoreProductGrid;
