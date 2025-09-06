
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface SizesManagerProps {
  sizes: string[];
  onSizesChange: (sizes: string[]) => void;
}

const SizesManager = ({ sizes, onSizesChange }: SizesManagerProps) => {
  const [newSize, setNewSize] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Predefined sizes
  const predefinedSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const toggleSize = (size: string) => {
    if (sizes.includes(size)) {
      onSizesChange(sizes.filter(s => s !== size));
    } else {
      onSizesChange([...sizes, size]);
    }
  };

  const addCustomSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      onSizesChange([...sizes, newSize.trim()]);
      setNewSize("");
      setShowCustomInput(false);
    }
  };

  const removeCustomSize = (sizeToRemove: string) => {
    if (!predefinedSizes.includes(sizeToRemove)) {
      onSizesChange(sizes.filter(size => size !== sizeToRemove));
    }
  };

  return (
    <div className="space-y-4">
      <Label className="block text-black font-medium text-right">القياسات المتوفرة</Label>
      
      {/* Predefined sizes grid */}
      <div className="grid grid-cols-3 gap-3">
        {predefinedSizes.map((size) => (
          <div 
            key={size} 
            className="flex items-center justify-between p-3 border-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => toggleSize(size)}
          >
            <Checkbox 
              checked={sizes.includes(size)}
              onChange={() => toggleSize(size)}
              className="pointer-events-none"
            />
            <span className="font-medium text-black">{size}</span>
          </div>
        ))}
      </div>

      {/* Custom sizes */}
      {sizes.filter(size => !predefinedSizes.includes(size)).length > 0 && (
        <div className="space-y-2">
          <Label className="block text-gray-600 text-sm text-right">قياسات مخصصة</Label>
          <div className="flex flex-wrap gap-2">
            {sizes.filter(size => !predefinedSizes.includes(size)).map((size, index) => (
              <div
                key={index}
                className="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() => removeCustomSize(size)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <span className="text-blue-700 font-medium">{size}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add custom size */}
      {showCustomInput ? (
        <div className="flex gap-2 p-3 bg-gray-50 rounded-xl">
          <Button
            type="button"
            onClick={addCustomSize}
            size="sm"
            className="text-white"
            style={{ 
              background: 'linear-gradient(135deg, #10b981, #059669)',
            }}
          >
            إضافة
          </Button>
          <Input
            type="text"
            placeholder="أدخل قياس مخصص"
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomSize()}
            className="text-right text-black flex-1"
            autoFocus
          />
          <Button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              setNewSize("");
            }}
            variant="outline"
            size="sm"
          >
            إلغاء
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setShowCustomInput(true)}
          variant="outline"
          className="w-full border-dashed border-2 py-6 text-gray-500 hover:text-gray-700 hover:border-gray-400"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة قياس مخصص
        </Button>
      )}
    </div>
  );
};

export default SizesManager;
