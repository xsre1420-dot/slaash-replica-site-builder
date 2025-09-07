import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Upload } from "lucide-react";
import { ColorOption } from "@/types";

interface ColorSwatchPickerProps {
  colors: ColorOption[];
  onColorsChange: (colors: ColorOption[]) => void;
}

const ColorSwatchPicker = ({ colors, onColorsChange }: ColorSwatchPickerProps) => {
  const [customColor, setCustomColor] = useState("#000000");

  const addCustomColor = () => {
    if (customColor) {
      const newColor: ColorOption = {
        value: customColor,
      };
      onColorsChange([...colors, newColor]);
      setCustomColor("#000000");
    }
  };

  const handleImageUpload = (colorIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const updatedColors = [...colors];
        updatedColors[colorIndex] = {
          ...updatedColors[colorIndex],
          image: e.target?.result as string
        };
        onColorsChange(updatedColors);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeColor = (index: number) => {
    const updatedColors = colors.filter((_, i) => i !== index);
    onColorsChange(updatedColors);
  };

  return (
    <div className="space-y-4">
      <Label className="text-right block">الألوان المتاحة</Label>
      
      {/* Selected Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {colors.map((color, index) => (
          <div key={index} className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-gray-50">
            <div 
              className="w-12 h-12 rounded-full border-2 border-gray-300" 
              style={{ backgroundColor: color.value }}
            />
            {color.image && (
              <img 
                src={color.image} 
                alt={`صورة اللون`}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(index, e)}
                  className="hidden"
                />
                <Upload className="w-4 h-4 text-blue-600 hover:text-blue-800" />
              </label>
              <button 
                onClick={() => removeColor(index)}
                className="text-red-500 hover:text-red-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Color */}
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="flex gap-3 items-end justify-center">
          <div>
            <Label htmlFor="customColor" className="text-right block mb-1">اللون</Label>
            <input
              id="customColor"
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
          </div>
          <Button 
            type="button"
            onClick={addCustomColor}
            className="px-3"
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ColorSwatchPicker;