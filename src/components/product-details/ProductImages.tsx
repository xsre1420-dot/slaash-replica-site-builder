
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface ProductImagesProps {
  images: string[];
  productName: string;
  isLarge?: boolean;
}

const ProductImages = ({ images, productName, isLarge = false }: ProductImagesProps) => {
  // Use different aspect ratios based on isLarge prop
  const aspectRatio = isLarge ? 4/3 : 16/9;
  
  return (
    <div className="w-full">
      {images.length > 1 ? (
        <Carousel className="w-full">
          <CarouselContent>
            {images.map((img, index) => (
              <CarouselItem key={index} className="relative">
                <AspectRatio ratio={aspectRatio} className="bg-gray-100 rounded-3xl overflow-hidden">
                  <img
                    src={img}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                </AspectRatio>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border-0 shadow-lg" />
          <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border-0 shadow-lg" />
        </Carousel>
      ) : (
        <AspectRatio ratio={aspectRatio} className="bg-gray-100 rounded-3xl overflow-hidden">
          <img
            src={images[0]}
            alt={productName}
            className="w-full h-full object-cover"
          />
        </AspectRatio>
      )}
    </div>
  );
};

export default ProductImages;
