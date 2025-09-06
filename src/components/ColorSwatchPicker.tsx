import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, ImagePlus } from "lucide-react";
import { useState, useRef } from "react";
import { ColorOption } from "@/types";

interface ColorSwatchPickerProps {
  colors: ColorOption[];
  onColorsChange: (colors: ColorOption[]) => void;
}

// Remove default colors as requested
const defaultColors: ColorOption[] = [];

const ColorSwatchPicker = ({ colors, onColorsChange }: ColorSwatchPickerProps) => {
  const [selectedColor, setSelectedColor] = useState("#2563eb");
  const [colorName, setColorName] = useState("");
  const [colorImage, setColorImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setColorImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addColor = () => {
    if (colorName.trim() && !colors.some(c => c.value === selectedColor)) {
      const newColor: ColorOption = {
        name: colorName.trim(),
        value: selectedColor,
        image: colorImage || undefined
      };
      onColorsChange([...colors, newColor]);
      setColorName("");
      setColorImage(null);
    }
  };

  const removeColor = (colorToRemove: ColorOption) => {
    onColorsChange(colors.filter(color => color.value !== colorToRemove.value));
  };

  return (
    <div className="space-y-4">
      <Label className="block text-black text-right">الألوان المتوفرة (اختياري)</Label>
      
      {/* Custom color picker */}
      <div className="space-y-3">
        <Label className="block text-sm text-gray-600 text-right">أضف لون مخصص:</Label>
        
        {/* Color name and color picker */}
        <div className="flex gap-2">
          <Button 
            type="button"
            onClick={addColor}
            size="sm"
            className="text-white shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #5b47f5, #4c3ef7)',
              boxShadow: '0 4px 15px rgba(91, 71, 245, 0.3)'
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="w-16 h-10 p-1 rounded-xl border-gray-200"
          />
          <Input
            type="text"
            placeholder="اسم اللون"
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addColor()}
            className="text-right text-black focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Color image upload */}
        <div className="space-y-2">
          <Label className="block text-sm text-gray-600 text-right">صورة اللون (اختياري):</Label>
          <div className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              <ImagePlus className="w-4 h-4 ml-1" />
              اختر صورة
            </Button>
            {colorImage && (
              <div className="flex items-center gap-2">
                <img 
                  src={colorImage} 
                  alt="معاينة صورة اللون" 
                  className="w-10 h-10 rounded-lg border object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColorImage(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display selected colors */}
      {colors.length > 0 && (
        <div className="space-y-2">
          <Label className="block text-sm text-gray-600 text-right">الألوان المحددة:</Label>
          <div className="flex flex-wrap gap-3">
            {colors.map((color, index) => (
              <div
                key={index}
                className="relative group"
              >
                <button
                  type="button"
                  onClick={() => removeColor(color)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden">
                  {color.image ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={color.image} 
                        alt={color.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-1">
                        <span className="text-xs font-medium px-1 py-0.5 rounded bg-white/90 text-black">
                          {color.name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full h-full flex items-end justify-center pb-1"
                      style={{ backgroundColor: color.value }}
                    >
                      <span 
                        className="text-xs font-medium px-1 py-0.5 rounded bg-white/80 backdrop-blur-sm text-black"
                      >
                        {color.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSwatchPicker;