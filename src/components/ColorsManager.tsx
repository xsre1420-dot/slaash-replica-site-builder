
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { useState } from "react";

interface ColorsManagerProps {
  colors: string[];
  onColorsChange: (colors: string[]) => void;
}

const ColorsManager = ({ colors, onColorsChange }: ColorsManagerProps) => {
  const [newColor, setNewColor] = useState("");

  const addColor = () => {
    if (newColor.trim() && !colors.includes(newColor.trim())) {
      onColorsChange([...colors, newColor.trim()]);
      setNewColor("");
    }
  };

  const removeColor = (colorToRemove: string) => {
    onColorsChange(colors.filter(color => color !== colorToRemove));
  };

  return (
    <div className="space-y-4">
      <Label className="block text-dark-green text-right">الألوان المتوفرة (اختياري)</Label>
      
      {/* Add new color */}
      <div className="flex gap-2">
        <Button 
          type="button"
          onClick={addColor}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Input
          type="text"
          placeholder="أدخل اللون (مثل: أحمر، أزرق، أخضر)"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addColor()}
          className="text-right text-dark-green"
        />
      </div>

      {/* Display existing colors */}
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {colors.map((color, index) => (
            <div
              key={index}
              className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm"
            >
              <button
                type="button"
                onClick={() => removeColor(color)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="text-dark-green">{color}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorsManager;
