
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
  const { addToCart, cartCount } = useCart();

  const handleAddToCart = () => {
    if (product) {
      for (let i = 0; i < quantity; i++) {
        addToCart(product);
      }
      setQuantity(1);
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
        <div className="min-h-screen flex items-center justify-center">
          <p>جاري التحميل...</p>
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
        <div className="bg-white">
          <ProductImages images={allImages} productName={product.name} isLarge={true} />
        </div>

        {/* Product Details - Scrollable */}
        <div className="flex-1 bg-white p-6 space-y-5">
          <ProductInfo 
            name={product.name}
            price={product.price}
            description={product.description}
            category={product.category}
          />

          {/* Quantity Selector */}
          <div className="flex justify-center">
            <ProductQuantity 
              quantity={quantity}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
            />
          </div>

          {/* Add to Cart Button - Above Cart */}
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
