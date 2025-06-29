
import { useState } from "react";

interface ProductInfoProps {
  name: string;
  price: number;
  description: string;
  category: string;
  sizes?: string[];
  colors?: string[];
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

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    onSizeSelect?.(size);
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onColorSelect?.(color);
  };

  // Function to get color background based on color name
  const getColorBackground = (colorName: string) => {
    const colorMap: { [key: string]: string } = {
      'أحمر': '#dc2626',
      'أزرق': '#2563eb',
      'أخضر': '#16a34a',
      'أصفر': '#ca8a04',
      'بنفسجي': '#7c3aed',
      'وردي': '#db2777',
      'برتقالي': '#ea580c',
      'أسود': '#000000',
      'أبيض': '#ffffff',
      'رمادي': '#6b7280',
      'بني': '#92400e',
    };
    
    return colorMap[colorName.toLowerCase()] || '#6b7280';
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <span className="text-2xl font-bold text-black">
          {price.toLocaleString()} د.ع
        </span>
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
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  selectedColor === color
                    ? 'border-orange-400 shadow-md ring-2 ring-orange-200'
                    : 'border-gray-200 hover:border-orange-400'
                }`}
                style={{ 
                  backgroundColor: getColorBackground(color),
                  color: color === 'أبيض' || color === 'أصفر' ? '#000000' : '#ffffff'
                }}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductInfo;
