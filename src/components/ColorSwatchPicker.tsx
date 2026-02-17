import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      const newColor: ColorOption = { value: customColor };
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
    onColorsChange(colors.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <Label className="text-right block font-medium text-foreground">الألوان المتاحة</Label>
      
      {/* Selected Colors */}
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-end">
          {colors.map((color, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5 p-2.5 border border-border rounded-xl bg-card">
              <div 
                className="w-10 h-10 rounded-full border-2 border-border shadow-sm" 
                style={{ backgroundColor: color.value }}
              />
              {color.image && (
                <img 
                  src={color.image} 
                  alt="صورة اللون"
                  className="w-14 h-14 object-cover rounded-lg"
                />
              )}
              <div className="flex gap-2 items-center">
                <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(index, e)}
                    className="hidden"
                  />
                  <Upload className="w-3.5 h-3.5" />
                </label>
                <button 
                  type="button"
                  onClick={() => removeColor(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Custom Color */}
      <div className="flex gap-3 items-center justify-end">
        <Button 
          type="button"
          onClick={addCustomColor}
          size="icon"
          variant="outline"
          className="rounded-xl border-border hover:bg-accent h-10 w-10 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-10 h-10 border border-border rounded-xl cursor-pointer bg-transparent"
        />
      </div>
    </div>
  );
};

export default ColorSwatchPicker;
