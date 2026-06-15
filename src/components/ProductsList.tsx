
import { Button } from "@/components/ui/button";
import { Edit, Plus, Star, MessageSquare, GripVertical, Copy, Zap, Eye } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { loadProducts, addProduct, invalidateProducts, updateProduct } from "@/services/productService";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import { Product } from "@/types";
import { isProductLowStock } from '@/lib/productUpdateUtils';
import { toast } from "sonner";
import React from "react";
import { QuickEditDialog } from "@/components/product-management/QuickEditDialog";
import OptimizedImage from "@/components/OptimizedImage";
import { generateUUID } from "@/lib/uuid";

const DragDropContext = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.DragDropContext })));
const Droppable = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.Droppable })));
const Draggable = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.Draggable })));
type DropResult = import("@hello-pangea/dnd").DropResult;

interface ProductsListProps {
  onProductSelect?: (product: {id: string, name: string}) => void;
  /** Full catalog from parent (preferred — avoids duplicate/stale loads) */
  products?: Product[];
  filteredProducts?: Product[];
  filtersActive?: boolean;
  onProductsChange?: (products: Product[]) => void;
  /** @deprecated Use onProductsChange */
  onProductsLoaded?: (products: Product[]) => void;
  onClearFilters?: () => void;
  reloadToken?: number;
  isLoading?: boolean;
}

const applyDisplayOrder = (items: Product[]): Product[] => {
  const savedOrder = localStorage.getItem('products_display_order');
  if (!savedOrder) return items;
  try {
    const orderMap: Record<string, number> = JSON.parse(savedOrder);
    return [...items].sort((a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999));
  } catch {
    return items;
  }
};

export const ProductsList = ({
  onProductSelect,
  products: productsFromParent,
  filteredProducts,
  filtersActive = false,
  onProductsChange,
  onProductsLoaded,
  onClearFilters,
  reloadToken = 0,
  isLoading: isLoadingFromParent,
}: ProductsListProps = {}) => {
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(!productsFromParent);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const navigate = useNavigate();
  const { isReady } = useStoreHydration();
  const managedByParent = productsFromParent !== undefined;
  const syncProducts = onProductsChange ?? onProductsLoaded;
  const isLoading = isLoadingFromParent ?? isLoadingLocal;

  const allProducts = useMemo(
    () => applyDisplayOrder(managedByParent ? (productsFromParent ?? []) : localProducts),
    [managedByParent, productsFromParent, localProducts]
  );

  useEffect(() => {
    if (managedByParent || !isReady) return;

    const loadProductsData = async () => {
      setIsLoadingLocal(true);
      try {
        const productsData = applyDisplayOrder(await loadProducts(true));
        setLocalProducts(productsData);
        syncProducts?.(productsData);
      } finally {
        setIsLoadingLocal(false);
      }
    };
    loadProductsData();

    let lastFocusRefresh = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh < 60_000) return;
      lastFocusRefresh = now;
      loadProductsData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady, reloadToken, managedByParent, syncProducts]);

  useEffect(() => {
    if (managedByParent) setIsLoadingLocal(false);
  }, [managedByParent, productsFromParent]);

  const catalog = useMemo(() => {
    if (filtersActive) return filteredProducts ?? [];
    if (filteredProducts && filteredProducts.length > 0) return filteredProducts;
    return allProducts;
  }, [filtersActive, filteredProducts, allProducts]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(allProducts);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    if (managedByParent) {
      syncProducts?.(items);
    } else {
      setLocalProducts(items);
      syncProducts?.(items);
    }

    const orderMap: Record<string, number> = {};
    items.forEach((item, index) => { orderMap[item.id] = index; });
    localStorage.setItem('products_display_order', JSON.stringify(orderMap));
    toast.success("تم حفظ ترتيب المنتجات", { duration: 1500 });
  }, [allProducts, managedByParent, syncProducts]);

  const refreshCatalog = useCallback(async () => {
    await invalidateProducts();
    const productsData = applyDisplayOrder(await loadProducts(true));
    if (managedByParent) {
      syncProducts?.(productsData);
    } else {
      setLocalProducts(productsData);
      syncProducts?.(productsData);
    }
    return productsData;
  }, [managedByParent, syncProducts]);

  const handlePublish = async (product: Product) => {
    const result = await updateProduct(product.id, { isActive: true });
    if (result.success) {
      toast.success(`تم نشر "${product.name}" في المتجر`);
      await refreshCatalog();
    } else {
      toast.error(result.error || "فشل في نشر المنتج");
    }
  };

  const handleDuplicate = async (product: Product) => {
    const duplicated: Product = {
      ...product,
      id: generateUUID(),
      name: `${product.name} (نسخة)`,
    };
    const result = await addProduct(duplicated);
    if (result.success) {
      toast.success("تم تكرار المنتج بنجاح");
      await refreshCatalog();
    } else {
      toast.error("فشل في تكرار المنتج");
    }
  };

  if (!isReady || isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
            <div className="h-48 bg-muted" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-2/3 mr-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (catalog.length === 0 && allProducts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <span className="text-3xl">📦</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد منتجات مسجلة</h3>
        <p className="text-sm text-muted-foreground mb-6">يمكنك البدء بإضافة منتجات جديدة</p>
        <Link to="/add-product">
          <Button variant="outline" className="rounded-xl px-8 border-border text-foreground">
            <Plus className="w-4 h-4 ml-2" />
            إضافة منتج جديد
          </Button>
        </Link>
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">لا توجد منتجات تطابق معايير البحث</p>
        {onClearFilters && (
          <Button variant="outline" className="rounded-xl min-h-[44px]" onClick={onClearFilters}>
            مسح الفلاتر
          </Button>
        )}
      </div>
    );
  }

  const renderProductCard = (product: Product, index: number, dragHandleProps?: any) => (
    <div 
      className={`bg-card rounded-2xl overflow-hidden shadow-sm border border-border hover:shadow-md transition-all duration-300 ${
        onProductSelect ? 'cursor-pointer' : ''
      }`}
      onClick={onProductSelect ? () => onProductSelect({id: product.id, name: product.name}) : undefined}
    >
      <div className="relative overflow-hidden">
        {isDragEnabled && dragHandleProps && (
          <div 
            {...dragHandleProps} 
            className="absolute top-4 left-4 z-10 w-10 h-10 bg-background/90 backdrop-blur-sm rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <OptimizedImage
          src={product.image}
          alt={product.name}
          className="w-full h-48"
          loading="lazy"
        />
        {product.isActive === false && (
          <div className="absolute top-3 left-3 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-lg font-semibold border border-border">
            مسودة
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link to={`/edit-product/${product.id}`}>
            <Button 
              size="icon"
              variant="secondary"
              className="min-h-[44px] min-w-[44px] bg-background/90 backdrop-blur-sm hover:bg-background text-foreground rounded-xl shadow-md"
              aria-label={`تعديل ${product.name}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <Button 
            size="icon"
            variant="secondary"
            className="min-h-[44px] min-w-[44px] bg-background/90 backdrop-blur-sm hover:bg-background text-foreground rounded-xl shadow-md"
            onClick={() => { setQuickEditProduct(product); setQuickEditOpen(true); }}
            aria-label={`تعديل سريع ${product.name}`}
          >
            <Zap className="w-4 h-4" />
          </Button>
          <Button 
            size="icon"
            variant="secondary"
            className="min-h-[44px] min-w-[44px] bg-background/90 backdrop-blur-sm hover:bg-background text-foreground rounded-xl shadow-md"
            onClick={() => handleDuplicate(product)}
            aria-label={`تكرار ${product.name}`}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        {/* Stock badge */}
        {product.stockQuantity !== undefined && product.stockQuantity === 0 && (
          <div className="absolute bottom-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
            نفد المخزون
          </div>
        )}
        {isProductLowStock(product) && (
          <div className="absolute bottom-3 right-3 bg-yellow-500 text-white text-xs px-2 py-1 rounded-lg">
            كمية منخفضة
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          {product.rating != null && product.rating > 0 ? (
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
              <span className="text-xs font-medium text-muted-foreground">{product.rating.toFixed(1)}</span>
            </div>
          ) : (
            <span />
          )}
          <h3 className="text-sm font-bold text-foreground text-right truncate flex-1 mr-2">{product.name}</h3>
        </div>
        
        <p className="text-xs text-muted-foreground mb-3 text-right line-clamp-1">{product.description}</p>
        
        <div className="flex items-end justify-between">
          <div className="flex flex-col items-start">
            <span className="text-lg font-bold text-foreground">{product.price.toLocaleString()} <span className="text-xs text-muted-foreground">د.ع</span></span>
            {product.stockQuantity !== undefined && (
              <span className="text-xs text-muted-foreground">الكمية: {product.stockQuantity}</span>
            )}
          </div>
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            {product.isActive === false && (
              <Button
                size="sm"
                className="rounded-lg text-xs px-2 h-8 gap-1"
                onClick={() => handlePublish(product)}
              >
                <Eye className="w-3 h-3" />
                نشر
              </Button>
            )}
            {onProductSelect && (
              <Button 
                size="sm"
                variant="outline"
                className="rounded-lg border-border text-foreground text-xs px-2 h-8"
                onClick={() => onProductSelect({id: product.id, name: product.name})}
              >
                <MessageSquare className="w-3 h-3 ml-1" />
                التعليقات
              </Button>
            )}
          </div>
        </div>

        {(product.colors || product.sizes) && (
          <div className="mt-2.5 pt-2.5 border-t border-border flex flex-wrap gap-2">
            {product.colors && product.colors.length > 0 && (
              <div className="flex items-center gap-1">
                {product.colors.slice(0, 4).map((color, i) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-full border border-border" style={{ backgroundColor: color.value }} />
                ))}
                {product.colors.length > 4 && <span className="text-xs text-muted-foreground">+{product.colors.length - 4}</span>}
              </div>
            )}
            {product.sizes && product.sizes.length > 0 && (
              <div className="flex items-center gap-1">
                {product.sizes.slice(0, 3).map((size, i) => (
                  <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{size}</span>
                ))}
                {product.sizes.length > 3 && <span className="text-xs text-muted-foreground">+{product.sizes.length - 3}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant={isDragEnabled ? "default" : "outline"}
          size="sm"
          className="rounded-xl text-xs"
          onClick={() => setIsDragEnabled(!isDragEnabled)}
        >
          <GripVertical className="w-3.5 h-3.5 ml-1" />
          {isDragEnabled ? "إنهاء الترتيب" : "ترتيب المنتجات"}
        </Button>
        <span className="text-sm text-muted-foreground">{catalog.length} منتج</span>
      </div>

      {isDragEnabled ? (
        <React.Suspense fallback={<div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="products" direction="vertical">
              {(provided) => (
                <div 
                  ref={provided.innerRef} 
                  {...provided.droppableProps}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {allProducts.map((product, index) => (
                    <Draggable key={product.id} draggableId={product.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? 'opacity-80 scale-[1.02] z-50' : ''}
                        >
                          {renderProductCard(product, index, provided.dragHandleProps)}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </React.Suspense>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((product, index) => (
            <div key={product.id}>
              {renderProductCard(product, index)}
            </div>
          ))}
        </div>
      )}

      <QuickEditDialog
        product={quickEditProduct}
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
        onSaved={refreshCatalog}
      />
    </div>
  );
};
