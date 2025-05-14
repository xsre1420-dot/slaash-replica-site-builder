
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="min-h-screen bg-gray-50">
      <ProductData productId={productId} onProductLoaded={setProduct} />
      <ProductHeader />

      {/* Main Content - Full Width */}
      <div className="w-full mx-auto">
        <Card className="overflow-hidden border-0 rounded-none">
          <CardContent className="p-0">
            <ProductImages images={allImages} productName={product.name} />

            {/* Product Details */}
            <div className="p-6 space-y-5">
              <ProductInfo 
                name={product.name}
                price={product.price}
                description={product.description}
                category={product.category}
              />

              <div className="flex justify-between items-center border-t pt-5">
                <AddToCartButton onClick={handleAddToCart} />
                <ProductQuantity 
                  quantity={quantity}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CartButton cartCount={cartCount} />
    </div>
  );
};

export default ProductDetails;
