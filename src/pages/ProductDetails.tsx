import { useParams } from "react-router-dom";
import { useState } from "react";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Truck, Shield, RotateCcw } from "lucide-react";

// Import the new smaller components
import ProductHeader from "@/components/product-details/ProductHeader";
import ProductImages from "@/components/product-details/ProductImages";
import ProductInfo from "@/components/product-details/ProductInfo";
import ProductQuantity from "@/components/product-details/ProductQuantity";
import AddToCartButton from "@/components/product-details/AddToCartButton";
import CartButton from "@/components/product-details/CartButton";
import ProductData from "@/components/product-details/ProductData";
import ExpandableSection from "@/components/product-details/ExpandableSection";
import RatingSection from "@/components/product-details/RatingSection";
import SuggestedProducts from "@/components/product-details/SuggestedProducts";

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const { addToCart, cartCount } = useCart();
  const { storeSettings } = useStore();

  const handleAddToCart = () => {
    if (product) {
      // Add with selected options
      addToCart(product, selectedSize, selectedColor);
      setQuantity(1);
      // Clear selections after adding to cart
      setSelectedSize("");
      setSelectedColor("");
      console.log('Selected options:', { size: selectedSize, color: selectedColor });
    }
  };

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  if (!product) {
    return (
      <>
        <ProductData productId={productId} onProductLoaded={setProduct} />
        <div className="min-h-screen flex items-center justify-center" 
             style={{ backgroundColor: storeSettings.menuBackgroundColor || '#f9fafb' }}>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full animate-pulse"
                 style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e, #ec4899)' }}></div>
            <p className="text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </>
    );
  }

  // Get all available images (main image + any additional images)
  const allImages = product.additionalImages ? [product.image, ...product.additionalImages] : [product.image];

  // Reviews are loaded from Supabase inside RatingSection to ensure authenticity

  return (
    <div className="min-h-screen bg-gray-50">
      <ProductData productId={productId} onProductLoaded={setProduct} />
      <ProductHeader />

      {/* Main Content */}
      <div className="max-w-md mx-auto bg-white">
        {/* Product Images */}
        <div className="px-6 pt-6">
          <ProductImages images={allImages} productName={product.name} isLarge={true} />
        </div>

        {/* Product Info Card */}
        <div className="p-6 space-y-6">
          {/* Basic Product Info */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="text-left">
                <span className="text-3xl font-bold text-gray-900">
                  {product.price.toLocaleString()} د.ع
                </span>
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
              </div>
            </div>

          </div>

          {/* Size & Color Selection */}
          {(product.sizes?.length > 0 || product.colors?.length > 0) && (
            <div className="space-y-4">
              {product.sizes && product.sizes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 text-right">المقاس</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {product.sizes.map((size, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          selectedSize === size
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.colors && product.colors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 text-right">اللون</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {product.colors.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedColor(color.value)}
                        className={`w-12 h-12 rounded-lg border-2 transition-all ${
                          selectedColor === color.value
                            ? 'border-gray-900 ring-2 ring-gray-300'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color.value }}
                      >
                        {color.image && (
                          <img 
                            src={color.image} 
                            alt="لون المنتج"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add to Cart Button */}
          <AddToCartButton onClick={handleAddToCart} />

          {/* Expandable Sections */}
          <div className="space-y-1 border-t border-gray-100 pt-6">
            <ExpandableSection title="الوصف" defaultOpen>
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </ExpandableSection>
          </div>

          {/* Rating Section */}
          <RatingSection productId={productId || ""} />

          {/* Suggested Products */}
          <SuggestedProducts currentProductId={productId || ""} category={product.category} />
        </div>
      </div>

      <CartButton cartCount={cartCount} />
    </div>
  );
};

export default ProductDetails;
