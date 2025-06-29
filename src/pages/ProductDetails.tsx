
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";

// Import the new smaller components
import ProductHeader from "@/components/product-details/ProductHeader";
import ProductImages from "@/components/product-details/ProductImages";
import ProductInfo from "@/components/product-details/ProductInfo";
import ProductQuantity from "@/components/product-details/ProductQuantity";
import AddToCartButton from "@/components/product-details/AddToCartButton";
import CartButton from "@/components/product-details/CartButton";
import ProductData from "@/components/product-details/ProductData";

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const { addToCart, cartCount } = useCart();

  const handleAddToCart = () => {
    if (product) {
      // Add only one item at a time regardless of quantity selected
      addToCart(product);
      setQuantity(1);
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full animate-pulse"></div>
            <p className="text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </>
    );
  }

  // Get all available images (main image + any additional images)
  const allImages = product.additionalImages ? [product.image, ...product.additionalImages] : [product.image];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      <ProductData productId={productId} onProductLoaded={setProduct} />
      <ProductHeader />

      {/* Main Content - Full Width and Height */}
      <div className="flex-1 flex flex-col">
        {/* Large Product Images - Takes more space */}
        <div className="bg-gray-50 p-6">
          <ProductImages images={allImages} productName={product.name} isLarge={true} />
        </div>

        {/* Product Details - Modern Card Style */}
        <div className="flex-1 bg-white rounded-t-3xl p-6 space-y-6 -mt-6 relative z-10">
          <ProductInfo 
            name={product.name}
            price={product.price}
            description={product.description}
            category={product.category}
            sizes={product.sizes}
            colors={product.colors}
            onSizeSelect={setSelectedSize}
            onColorSelect={setSelectedColor}
          />

          {/* Quantity Selector */}
          <div className="flex justify-center">
            <ProductQuantity 
              quantity={quantity}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
            />
          </div>

          {/* Add to Cart Button - Modern Style */}
          <div className="pt-4">
            <AddToCartButton onClick={handleAddToCart} />
          </div>
        </div>
      </div>

      <CartButton cartCount={cartCount} />
    </div>
  );
};

export default ProductDetails;
