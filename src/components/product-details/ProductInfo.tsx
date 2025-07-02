
import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { ColorOption } from "@/types";

interface ProductInfoProps {
  name: string;
  price: number;
  description: string;
  category: string;
  sizes?: string[];
  colors?: ColorOption[];
  onSizeSelect?: (size: string) => void;
  onColorSelect?: (color: string) => void;
}

const ProductInfo = ({ 
  name, 
  price, 
  description, 
  category, 
  sizes, 
  colors, 
  onSizeSelect, 
  onColorSelect 
}: ProductInfoProps) => {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const { storeSettings } = useStore();

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    onSizeSelect?.(size);
  };

  const handleColorSelect = (color: ColorOption) => {
    setSelectedColor(color.name);
    onColorSelect?.(color.name);
  };

  // Function to get color background from ColorOption
  const getColorBackground = (color: ColorOption) => {
    return color.value;
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div className="text-left">
          <span className="text-2xl font-bold text-black">
            {price.toLocaleString()} د.ع
          </span>
          {storeSettings.deliveryPrices && storeSettings.deliveryPrices.length > 0 && (
            <div className="text-sm text-gray-600 mt-1">
              <div className="font-medium">أسعار التوصيل:</div>
              {storeSettings.deliveryPrices.map((delivery, index) => (
                <div key={index} className="flex justify-between">
                  <span>{delivery.price.toLocaleString()} د.ع</span>
                  <span>{delivery.governorate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold text-right">{name}</h2>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-gray-700 text-right leading-relaxed text-lg">{description}</p>
      </div>

      {/* Sizes Section */}
      {sizes && sizes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-right text-gray-800">القياسات المتاحة:</h3>
          <div className="flex flex-wrap gap-3 justify-end">
            {sizes.map((size, index) => (
              <button
                key={index}
                onClick={() => handleSizeSelect(size)}
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  selectedSize === size
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                }`}
                style={{
                  background: selectedSize === size 
                    ? 'linear-gradient(135deg, #ff6b35, #ec4899)' 
                    : undefined
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colors Section */}
      {colors && colors.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-right text-gray-800">الألوان المتاحة:</h3>
          <div className="flex flex-wrap gap-3 justify-end">
            {colors.map((color, index) => (
              <button
                key={index}
                onClick={() => handleColorSelect(color)}
                className={`w-16 h-16 rounded-xl border-2 transition-all relative overflow-hidden ${
                  selectedColor === color.name
                    ? 'border-orange-400 shadow-md ring-2 ring-orange-200'
                    : 'border-gray-200 hover:border-orange-400'
                }`}
                style={{ backgroundColor: getColorBackground(color) }}
              >
                <span 
                  className="absolute bottom-0 left-0 right-0 text-xs font-medium px-1 py-0.5 bg-white/90 backdrop-blur-sm"
                  style={{ color: '#000000' }}
                >
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductInfo;
