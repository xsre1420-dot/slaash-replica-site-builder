
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  Plus,
  Star,
  MessageSquare,
  GripVertical,
  Copy,
  Eye,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useCallback, useMemo } from "react";
import { Product } from "@/types";
import { isProductLowStock } from '@/lib/productUpdateUtils';
import { getProductLifecycleStatus, lifecycleStatusLabel } from '@/lib/productLifecycle';
import { toast } from "sonner";
import React from "react";
import OptimizedImage from "@/components/OptimizedImage";

const DragDropContext = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.DragDropContext })));
const Droppable = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.Droppable })));
const Draggable = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.Draggable })));
type DropResult = import("@hello-pangea/dnd").DropResult;

interface ProductsListProps {
  onProductSelect?: (product: {id: string, name: string}) => void;
  products: Product[];
  filteredProducts?: Product[];
  filtersActive?: boolean;
  onProductsChange?: (products: Product[]) => void;
  onProductsLoaded?: (products: Product[]) => void;
  onClearFilters?: () => void;
  reloadToken?: number;
  isLoading?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  selectionEnabled?: boolean;
  onPublish?: (product: Product) => void;
  onArchive?: (product: Product) => void;
  onRestore?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
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
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectionEnabled = false,
  onPublish,
  onArchive,
  onRestore,
  onDuplicate,
}: ProductsListProps) => {
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const syncProducts = onProductsChange ?? onProductsLoaded;
  const isLoading = isLoadingFromParent ?? false;

  const allProducts = useMemo(
    () => applyDisplayOrder(productsFromParent),
    [productsFromParent]
  );

  const catalog = useMemo(() => {
    if (!filtersActive) return allProducts;
    return filteredProducts ?? [];
  }, [filtersActive, filteredProducts, allProducts]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(allProducts);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    syncProducts?.(items);

    const orderMap: Record<string, number> = {};
    items.forEach((item, index) => { orderMap[item.id] = index; });
    localStorage.setItem('products_display_order', JSON.stringify(orderMap));
    toast.success("تم حفظ ترتيب المنتجات", { duration: 1500 });
  }, [allProducts, syncProducts]);

  if (isLoading) {
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

  const renderProductCard = (product: Product, dragHandleProps?: React.HTMLAttributes<HTMLElement>) => {
    const lifecycle = getProductLifecycleStatus(product);
    const selected = selectedIds?.has(product.id) ?? false;

    return (
      <div
        className={`bg-card rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 min-w-0 ${
          selected ? 'border-primary/40 ring-2 ring-primary/10' : 'border-border hover:shadow-md'
        } ${onProductSelect ? 'cursor-pointer' : ''}`}
        onClick={onProductSelect ? () => onProductSelect({ id: product.id, name: product.name }) : undefined}
      >
        <div className="relative overflow-hidden">
          {isDragEnabled && dragHandleProps && (
            <div
              {...dragHandleProps}
              className="absolute top-4 left-4 z-10 w-10 h-10 bg-background/90 backdrop-blur-sm rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md hidden sm:flex"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          {selectionEnabled && onToggleSelect && (
            <div
              className="absolute top-3 right-3 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(product.id)}
                className="h-5 w-5 rounded-md bg-background/90 border-border shadow-sm data-[state=checked]:bg-primary"
                aria-label={`تحديد ${product.name}`}
              />
            </div>
          )}

          <OptimizedImage src={product.image} alt={product.name} className="w-full h-40 sm:h-48" loading="lazy" />

          <div
            className={`absolute top-3 left-3 text-xs px-2.5 py-1 rounded-lg font-semibold border ${
              lifecycle === 'archived'
                ? 'bg-muted text-muted-foreground border-border'
                : lifecycle === 'draft'
                  ? 'bg-amber-500/15 text-amber-700 border-amber-500/25'
                  : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
            }`}
          >
            {lifecycleStatusLabel[lifecycle]}
          </div>

          {product.stockQuantity !== undefined && product.stockQuantity === 0 && (
            <div className="absolute bottom-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
              نفد المخزون
            </div>
          )}
          {isProductLowStock(product) && product.stockQuantity !== 0 && (
            <div className="absolute bottom-3 right-3 bg-yellow-500 text-white text-xs px-2 py-1 rounded-lg">
              كمية منخفضة
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-bold text-foreground text-right line-clamp-2 flex-1">{product.name}</h3>
            {product.rating != null && product.rating > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                <span className="text-xs font-medium text-muted-foreground">{product.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {product.category && (
            <p className="text-[10px] text-muted-foreground mb-2 text-right">{product.category}</p>
          )}

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col items-start min-w-0">
              <span className="text-base sm:text-lg font-bold text-foreground tabular-nums">
                {product.price.toLocaleString()} <span className="text-xs text-muted-foreground">د.ع</span>
              </span>
              {product.stockQuantity !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">المخزون: {product.stockQuantity}</span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Link to={`/edit-product/${product.id}`}>
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg" aria-label="تعديل">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {lifecycle === 'draft' && onPublish && (
                    <DropdownMenuItem onClick={() => onPublish(product)}>
                      <Eye className="w-4 h-4 ml-2" />
                      نشر
                    </DropdownMenuItem>
                  )}
                  {lifecycle === 'published' && onArchive && (
                    <DropdownMenuItem onClick={() => onArchive(product)}>
                      <Archive className="w-4 h-4 ml-2" />
                      أرشفة
                    </DropdownMenuItem>
                  )}
                  {lifecycle === 'archived' && onRestore && (
                    <DropdownMenuItem onClick={() => onRestore(product)}>
                      <ArchiveRestore className="w-4 h-4 ml-2" />
                      استرجاع
                    </DropdownMenuItem>
                  )}
                  {onDuplicate && (
                    <DropdownMenuItem onClick={() => onDuplicate(product)}>
                      <Copy className="w-4 h-4 ml-2" />
                      تكرار
                    </DropdownMenuItem>
                  )}
                  {onProductSelect && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onProductSelect({ id: product.id, name: product.name })}>
                        <MessageSquare className="w-4 h-4 ml-2" />
                        التعليقات
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {selectionEnabled && onToggleSelectAll && selectedIds && (
            <Button variant="ghost" size="sm" className="rounded-xl text-xs h-9" onClick={onToggleSelectAll}>
              {selectedIds.size === catalog.length ? 'إلغاء التحديد' : 'تحديد الكل'}
            </Button>
          )}
          <Button
            variant={isDragEnabled ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs hidden sm:inline-flex"
            onClick={() => setIsDragEnabled(!isDragEnabled)}
          >
            <GripVertical className="w-3.5 h-3.5 ml-1" />
            {isDragEnabled ? 'إنهاء الترتيب' : 'ترتيب المنتجات'}
          </Button>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">{catalog.length} منتج</span>
      </div>

      {isDragEnabled ? (
        <React.Suspense fallback={<div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="products" direction="vertical">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-w-0"
                >
                  {allProducts.map((product, index) => (
                    <Draggable key={product.id} draggableId={product.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? 'opacity-80 scale-[1.02] z-50' : ''}
                        >
                          {renderProductCard(product, provided.dragHandleProps ?? undefined)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-w-0">
          {catalog.map((product) => (
            <div key={product.id}>{renderProductCard(product)}</div>
          ))}
        </div>
      )}
    </div>
  );
};
