
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
  selectedSize?: string;
  selectedColor?: string;
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
  selectedSize: externalSelectedSize,
  selectedColor: externalSelectedColor,
  onSizeSelect, 
  onColorSelect 
}: ProductInfoProps) => {
  const { storeSettings } = useStore();

  const handleSizeSelect = (size: string) => {
    onSizeSelect?.(size);
  };

  const handleColorSelect = (color: ColorOption) => {
    onColorSelect?.(color.value);
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
                  externalSelectedSize === size
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                style={{
                  background: externalSelectedSize === size 
                    ? '#6366f1' 
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
                  externalSelectedColor === color.value
                    ? 'shadow-md ring-2'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{ 
                  backgroundColor: getColorBackground(color),
                  borderColor: externalSelectedColor === color.value ? '#6366f1' : undefined,
                  '--tw-ring-color': '#6366f1'
                } as React.CSSProperties}
              >
                {color.image ? (
                  <img 
                    src={color.image} 
                    alt="لون المنتج"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span 
                    className="absolute bottom-0 left-0 right-0 text-xs font-medium px-1 py-0.5 bg-white/90 backdrop-blur-sm"
                    style={{ color: '#000000' }}
                  >
                    لون
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductInfo;
