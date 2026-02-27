import { useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Truck, Shield, RotateCcw, Eye, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import ProductHeader from "@/components/product-details/ProductHeader";
import ProductImages from "@/components/product-details/ProductImages";
import ProductQuantity from "@/components/product-details/ProductQuantity";
import AddToCartButton from "@/components/product-details/AddToCartButton";
import CartButton from "@/components/product-details/CartButton";
import ProductData from "@/components/product-details/ProductData";
import ExpandableSection from "@/components/product-details/ExpandableSection";
import RatingSection from "@/components/product-details/RatingSection";
import SuggestedProducts from "@/components/product-details/SuggestedProducts";
import ScrollReveal from "@/components/product-details/ScrollReveal";

// Skeleton loading component
const ProductDetailsSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="bg-card p-4 sticky top-0 z-20 border-b border-border/50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex gap-2"><Skeleton className="w-9 h-9 rounded-full" /><Skeleton className="w-9 h-9 rounded-full" /></div>
        <Skeleton className="w-28 h-6" />
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>
    </div>
    <div className="max-w-md mx-auto bg-card">
      <div className="px-4 pt-4">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="flex gap-2 justify-center mt-3">
          {[1,2,3].map(i => <Skeleton key={i} className="w-14 h-14 rounded-xl" />)}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-between">
          <Skeleton className="w-28 h-8" />
          <Skeleton className="w-36 h-6" />
        </div>
        <Skeleton className="w-full h-12 rounded-lg" />
        <div className="flex gap-2 justify-end">
          {[1,2,3].map(i => <Skeleton key={i} className="w-16 h-10 rounded-xl" />)}
        </div>
        <Skeleton className="w-full h-14 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    </div>
  </div>
);

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart, cartCount, cartItems } = useCart();
  const { storeSettings } = useStore();

  const totalAmount = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // Social proof (simulated)
  const viewerCount = useMemo(() => Math.floor(Math.random() * 8) + 3, []);

  const handleAddToCart = () => {
    if (product && !isAdding) {
      setIsAdding(true);
      for (let i = 0; i < quantity; i++) {
        addToCart(product, selectedSize, selectedColor);
      }
      
      toast.success(`تمت إضافة "${product.name}" إلى السلة`, {
        description: [
          selectedSize && `المقاس: ${selectedSize}`,
          selectedColor && `اللون محدد`,
          quantity > 1 && `الكمية: ${quantity}`,
        ].filter(Boolean).join(' • ') || undefined,
      });

      setQuantity(1);
      setSelectedSize("");
      setSelectedColor("");
      setTimeout(() => setIsAdding(false), 500);
    }
  };

  // Badge logic
  const isNew = product && (product as any).created_at 
    ? (Date.now() - new Date((product as any).created_at).getTime()) < 7 * 24 * 60 * 60 * 1000 
    : false;
  const isLowStock = product?.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 3;
  const isOutOfStock = product?.stockQuantity !== undefined && product.stockQuantity === 0;
  const hasDiscount = product?.discountType && product.discountType !== 'none';
  const discountPercent = hasDiscount && product?.discountType === 'percentage' ? product.discountValue : undefined;

  if (!product) {
    return (
      <>
        <ProductData productId={productId} onProductLoaded={setProduct} />
        <ProductDetailsSkeleton />
      </>
    );
  }

  const allImages = product.additionalImages ? [product.image, ...product.additionalImages] : [product.image];

  return (
    <div className="min-h-screen bg-background">
      <ProductData productId={productId} onProductLoaded={setProduct} />
      <ProductHeader productId={product.id} productName={product.name} />

      <div className="max-w-md mx-auto bg-card">
        {/* Product Images with Parallax */}
        <div className="px-4 pt-4">
          <ProductImages 
            images={allImages} 
            productName={product.name} 
            isLarge 
            isNew={isNew}
            isLowStock={isLowStock}
            stockQuantity={product.stockQuantity}
            isOutOfStock={isOutOfStock}
            discountPercent={discountPercent}
          />
        </div>

        <div className="p-4 space-y-5">
          {/* Social Proof */}
          <ScrollReveal delay={0}>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs text-muted-foreground">{viewerCount} شخص يشاهد هذا المنتج الآن</span>
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </ScrollReveal>

          {/* Name & Price */}
          <ScrollReveal delay={50}>
            <div className="flex justify-between items-start gap-3">
              <div className="text-left">
                {hasDiscount && product.originalPrice ? (
                  <div className="flex flex-col items-start">
                    <span className="text-sm text-muted-foreground line-through">{product.originalPrice.toLocaleString()} د.ع</span>
                    <span className="text-2xl font-bold text-destructive">{product.price.toLocaleString()} د.ع</span>
                    {discountPercent && (
                      <span className="inline-block bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-lg font-bold mt-1">
                        وفّر {discountPercent}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground text-right flex-1">{product.name}</h1>
            </div>
          </ScrollReveal>

          {/* Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <ScrollReveal delay={100}>
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground text-right">المقاس</h3>
                <div className="flex flex-wrap gap-2 justify-end">
                  {product.sizes.map((size, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                        selectedSize === size
                          ? 'bg-foreground text-background border-foreground shadow-sm scale-105'
                          : 'bg-card text-foreground border-border hover:border-foreground/30 hover:scale-[1.02]'
                      }`}
                    >
                      {selectedSize === size && <Check className="w-3 h-3 inline ml-1" />}
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <ScrollReveal delay={150}>
              <div className="space-y-2.5">
                <div className="flex items-center justify-end gap-2">
                  {selectedColor && (
                    <span className="text-xs text-muted-foreground">
                      {product.colors.find(c => c.value === selectedColor)?.name || 'محدد'}
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-foreground">اللون</h3>
                </div>
                <div className="flex flex-wrap gap-2.5 justify-end">
                  {product.colors.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColor(selectedColor === color.value ? "" : color.value)}
                      className={`w-12 h-12 rounded-xl border-2 transition-all duration-200 relative overflow-hidden ${
                        selectedColor === color.value
                          ? 'border-foreground ring-2 ring-foreground/20 scale-110'
                          : 'border-border hover:border-foreground/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                    >
                      {color.image && (
                        <img src={color.image} alt="" className="w-full h-full object-cover" />
                      )}
                      {selectedColor === color.value && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* Quantity + Add to Cart */}
          <ScrollReveal delay={200}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ProductQuantity
                  quantity={quantity}
                  onIncrement={() => setQuantity(prev => product.stockQuantity ? Math.min(prev + 1, product.stockQuantity) : prev + 1)}
                  onDecrement={() => setQuantity(prev => Math.max(1, prev - 1))}
                />
                <h3 className="text-sm font-semibold text-foreground">الكمية</h3>
              </div>
              <AddToCartButton 
                onClick={handleAddToCart} 
                disabled={isAdding} 
                isOutOfStock={isOutOfStock}
              />
            </div>
          </ScrollReveal>

          {/* Guarantees Bar */}
          <ScrollReveal delay={250} animation="slide-up">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Truck className="w-5 h-5" />, label: "توصيل سريع" },
                { icon: <Shield className="w-5 h-5" />, label: "ضمان الجودة" },
                { icon: <RotateCcw className="w-5 h-5" />, label: "إرجاع سهل" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 py-3 bg-muted/50 rounded-xl" style={{ animationDelay: `${250 + i * 80}ms` }}>
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>

          {/* Description */}
          <ScrollReveal delay={300}>
            <div className="border-t border-border/50 pt-4">
              <ExpandableSection title="الوصف" defaultOpen>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-muted-foreground leading-relaxed text-sm">{product.description}</p>
                </div>
              </ExpandableSection>
            </div>
          </ScrollReveal>

          {/* Rating Section */}
          <ScrollReveal delay={350}>
            <RatingSection productId={productId || ""} />
          </ScrollReveal>

          {/* Suggested Products */}
          <ScrollReveal delay={400}>
            <SuggestedProducts currentProductId={productId || ""} category={product.category} />
          </ScrollReveal>
        </div>
      </div>

      {/* Bottom padding for cart button */}
      {cartCount > 0 && <div className="h-24" />}
      <CartButton cartCount={cartCount} totalAmount={totalAmount} />
    </div>
  );
};

export default ProductDetails;
