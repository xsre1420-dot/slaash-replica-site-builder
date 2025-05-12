
import { useParams, Link } from "react-router-dom";
import { ArrowRight, Plus, Minus, ShoppingCart } from "lucide-react";
import { useState, useEffect } from "react";
import { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

// Placeholder data for testing
const demoProducts: Product[] = [
  {
    id: "1",
    name: "برجر لحم",
    description: "برجر لحم طازج مع صلصة خاصة وخضروات",
    price: 8000,
    category: "برجر",
    image: "/placeholder.svg",
    images: ["/placeholder.svg", "/placeholder.svg"],
    featured: true,
  },
  {
    id: "2",
    name: "فاهيتا دجاج",
    description: "فاهيتا دجاج مشوي مع صوص خاص وخضروات",
    price: 7000,
    category: "ساندويش",
    image: "/placeholder.svg",
    featured: false,
  },
];

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    // Fetch product from localStorage or use demo data
    const storedProducts = localStorage.getItem("products");
    let foundProduct: Product | undefined;

    if (storedProducts) {
      try {
        const parsedProducts = JSON.parse(storedProducts);
        foundProduct = parsedProducts.find((p: Product) => p.id === productId);
      } catch (error) {
        console.error("Error parsing products:", error);
      }
    }

    // If not found in localStorage, check demo products
    if (!foundProduct) {
      foundProduct = demoProducts.find((p) => p.id === productId);
    }

    if (foundProduct) {
      setProduct(foundProduct);
    }
  }, [productId]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setQuantity(1);
  };

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const images = product.images || [product.image];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-red-600 text-white p-4">
        <div className="flex justify-between items-center">
          <Link to="/preview">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">تفاصيل المنتج</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-xl mx-auto p-4">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Product Images Carousel */}
            <div className="relative w-full">
              {images.length > 1 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {images.map((img, index) => (
                      <CarouselItem key={index} className="relative">
                        <div className="aspect-square w-full">
                          <img
                            src={img}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
                  <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
                </Carousel>
              ) : (
                <div className="aspect-square w-full">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <span className="text-xl font-bold text-red-600">
                  {product.price.toLocaleString()} د.ع
                </span>
                <h2 className="text-xl font-bold text-right">{product.name}</h2>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-700 text-right leading-relaxed">{product.description}</p>
              </div>

              <div className="text-right">
                <span className="inline-block bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                  {product.category}
                </span>
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                <Button 
                  onClick={handleAddToCart} 
                  className="bg-red-600 hover:bg-red-700 w-2/3 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  إضافة للسلة
                </Button>

                <div className="flex items-center">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full" 
                    onClick={handleIncrement}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="mx-3 text-lg font-medium">{quantity}</span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full" 
                    onClick={handleDecrement} 
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductDetails;
