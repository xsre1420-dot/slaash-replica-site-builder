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

// Remove default colors as requested
const defaultColors: ColorOption[] = [];

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

  const removeColor = (colorToRemove: ColorOption) => {
    onColorsChange(colors.filter(color => color.value !== colorToRemove.value));
  };

  return (
    <div className="space-y-4">
      <Label className="block text-black text-right">الألوان المتوفرة (اختياري)</Label>
      
      {/* Custom color picker */}
      <div className="space-y-3">
        <Label className="block text-sm text-gray-600 text-right">أضف لون مخصص:</Label>
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