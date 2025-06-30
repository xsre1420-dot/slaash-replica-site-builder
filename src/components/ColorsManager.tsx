
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

      {/* Display existing colors with modern design */}
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {colors.map((color, index) => (
            <div
              key={index}
              className="relative flex items-center rounded-xl px-4 py-3 text-sm font-medium text-white border-2 border-gray-200 hover:border-primary transition-colors"
              style={{ 
                backgroundColor: getColorBackground(color),
                color: color === 'أبيض' || color === 'أصفر' ? '#000000' : '#ffffff'
              }}
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
