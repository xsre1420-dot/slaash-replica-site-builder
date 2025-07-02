import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import { ColorOption } from "@/types";

interface ColorSwatchPickerProps {
  colors: ColorOption[];
  onColorsChange: (colors: ColorOption[]) => void;
}

const defaultColors: ColorOption[] = [
  { name: "أزرق", value: "#2563eb" },
  { name: "أسود", value: "#000000" },
  { name: "أحمر", value: "#dc2626" },
  { name: "أزرق داكن", value: "#1e3a8a" },
  { name: "رمادي", value: "#6b7280" },
  { name: "رمادي فاتح", value: "#d1d5db" },
];

const ColorSwatchPicker = ({ colors, onColorsChange }: ColorSwatchPickerProps) => {
  const [selectedColor, setSelectedColor] = useState("#2563eb");
  const [colorName, setColorName] = useState("");

  const addColor = () => {
    if (colorName.trim() && !colors.some(c => c.value === selectedColor)) {
      const newColor: ColorOption = {
        name: colorName.trim(),
        value: selectedColor
      };
      onColorsChange([...colors, newColor]);
      setColorName("");
    }
  };

  const addDefaultColor = (color: ColorOption) => {
    if (!colors.some(c => c.value === color.value)) {
      onColorsChange([...colors, color]);
    }
  };

  const removeColor = (colorToRemove: ColorOption) => {
    onColorsChange(colors.filter(color => color.value !== colorToRemove.value));
  };

  return (
    <div className="space-y-4">
      <Label className="block text-black text-right">الألوان المتوفرة (اختياري)</Label>
      
      {/* Default color swatches */}
      <div>
        <Label className="block text-sm text-gray-600 text-right mb-2">اختر من الألوان الافتراضية:</Label>
        <div className="flex flex-wrap gap-2">
          {defaultColors.map((color, index) => (
            <button
              key={index}
              type="button"
              onClick={() => addDefaultColor(color)}
              className="w-12 h-12 rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-all hover:scale-105 relative group"
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {colors.some(c => c.value === color.value) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full border-2 border-gray-800"></div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom color picker */}
      <div className="space-y-3">
        <Label className="block text-sm text-gray-600 text-right">أو أضف لون مخصص:</Label>
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
                <div
                  className="w-16 h-16 rounded-xl border-2 border-gray-200 flex items-end justify-center pb-1"
                  style={{ backgroundColor: color.value }}
                >
                  <span 
                    className="text-xs font-medium px-1 py-0.5 rounded bg-white/80 backdrop-blur-sm"
                    style={{ color: color.value === '#ffffff' ? '#000000' : '#000000' }}
                  >
                    {color.name}
                  </span>
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