import { memo, useCallback, useMemo, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
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
      <div className={viewMode === 'grid' ? 'sf-product-grid' : 'sf-product-list'}>
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} viewMode={viewMode} />
        ))}
      </div>
    );
  }

  if (visibleProducts.length === 0) {
    return (
      <div className="text-center py-24 px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-primary/10 flex items-center justify-center">
          <PackageSearch className="w-9 h-9 text-primary" strokeWidth={1.75} />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          {searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات'}
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          {searchQuery ? 'جرّب كلمات بحث مختلفة أو امسح الفلاتر' : 'تصفح الأقسام الأخرى أو عد لاحقاً'}
        </p>
      </div>
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
        <div ref={sentinelRef} className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">جاري تحميل المزيد...</p>
        </div>
      )}
    </>
  );
});

export default StoreProductGrid;
