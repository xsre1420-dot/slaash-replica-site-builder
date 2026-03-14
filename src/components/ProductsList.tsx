
import { Button } from "@/components/ui/button";
import { Edit, Plus, Star, MessageSquare, GripVertical, Copy, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { loadProducts, addProduct } from "@/data/dummyData";
import { Product } from "@/types";
import { toast } from "sonner";
import React from "react";
import { QuickEditDialog } from "@/components/product-management/QuickEditDialog";

const DragDropContext = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.DragDropContext })));
const Droppable = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.Droppable })));
const Draggable = React.lazy(() => import("@hello-pangea/dnd").then(m => ({ default: m.Draggable })));
type DropResult = import("@hello-pangea/dnd").DropResult;

interface ProductsListProps {
  onProductSelect?: (product: {id: string, name: string}) => void;
  onProductsLoaded?: (products: Product[]) => void;
  filteredProducts?: Product[];
}

export const ProductsList = ({ onProductSelect, onProductsLoaded, filteredProducts }: ProductsListProps = {}) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProductsData = async () => {
      const productsData = await loadProducts();
      const savedOrder = localStorage.getItem('products_display_order');
      if (savedOrder) {
        try {
          const orderMap: Record<string, number> = JSON.parse(savedOrder);
          productsData.sort((a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999));
        } catch {}
      }
      setAllProducts(productsData);
      onProductsLoaded?.(productsData);
    };
    loadProductsData();

    const handleFocus = () => { loadProductsData(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Use filteredProducts if provided, otherwise use all
  const products = filteredProducts ?? allProducts;

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(allProducts);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setAllProducts(items);
    onProductsLoaded?.(items);

    const orderMap: Record<string, number> = {};
    items.forEach((item, index) => { orderMap[item.id] = index; });
    localStorage.setItem('products_display_order', JSON.stringify(orderMap));
    toast.success("تم حفظ ترتيب المنتجات", { duration: 1500 });
  }, [allProducts, onProductsLoaded]);

  const handleDuplicate = async (product: Product) => {
    const duplicated: Product = {
      ...product,
      id: crypto.randomUUID(),
      name: `${product.name} (نسخة)`,
    };
    const result = await addProduct(duplicated);
    if (result.success) {
      toast.success("تم تكرار المنتج بنجاح");
      // Reload products
      const productsData = await loadProducts();
      setAllProducts(productsData);
      onProductsLoaded?.(productsData);
    } else {
      toast.error("فشل في تكرار المنتج");
    }
  };

  if (allProducts.length === 0) {
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

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">لا توجد منتجات تطابق معايير البحث</p>
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
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        <div className="absolute top-4 right-4 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link to={`/edit-product/${product.id}`}>
            <Button 
              size="sm"
              className="w-9 h-9 p-0 bg-background/90 backdrop-blur-sm hover:bg-background text-foreground rounded-lg shadow-md"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <Button 
            size="sm"
            className="w-9 h-9 p-0 bg-background/90 backdrop-blur-sm hover:bg-background text-foreground rounded-lg shadow-md"
            onClick={() => handleDuplicate(product)}
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
        {product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 5 && (
          <div className="absolute bottom-3 right-3 bg-yellow-500 text-white text-xs px-2 py-1 rounded-lg">
            كمية منخفضة
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
            <span className="text-xs font-medium text-muted-foreground">{product.rating ?? 4.5}</span>
          </div>
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
        <span className="text-sm text-muted-foreground">{products.length} منتج</span>
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
          {products.map((product, index) => (
            <div key={product.id}>
              {renderProductCard(product, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
