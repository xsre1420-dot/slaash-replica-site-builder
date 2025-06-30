
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
      <Label className="block text-gray-700 text-right">الألوان المتوفرة (اختياري)</Label>
      
      {/* Add new color */}
      <div className="flex gap-2">
        <Button 
          type="button"
          onClick={addColor}
          size="sm"
          className="text-white shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Input
          type="text"
          placeholder="أدخل اللون (مثل: أحمر، أزرق، أخضر)"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addColor()}
          className="text-right text-gray-700 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Display existing colors with modern design */}
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {colors.map((color, index) => (
            <div
              key={index}
              className="relative flex items-center bg-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 border-2 border-gray-200 hover:border-blue-500 transition-colors"
            >
              <button
                type="button"
                onClick={() => removeColor(color)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              <span>{color}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorsManager;
