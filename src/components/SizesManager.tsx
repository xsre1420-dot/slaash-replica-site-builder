import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface SizesManagerProps {
  sizes: string[];
  onSizesChange: (sizes: string[]) => void;
}

const SizesManager = ({ sizes, onSizesChange }: SizesManagerProps) => {
  const [newSize, setNewSize] = useState("");

  const addCustomSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      onSizesChange([...sizes, newSize.trim()]);
      setNewSize("");
    }
  };

  const removeCustomSize = (sizeToRemove: string) => {
    onSizesChange(sizes.filter(size => size !== sizeToRemove));
  };

  return (
    <div className="space-y-4">
      <Label className="block text-black text-right">القياسات المتوفرة (اختياري)</Label>
      
      {/* Add custom size input */}
      <div className="space-y-3">
        <Label className="block text-sm text-gray-600 text-right">أضف قياس:</Label>
        <div className="flex gap-2">
          <Button 
            type="button"
            onClick={addCustomSize}
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
            type="text"
            placeholder="مثال: XL أو 42 أو Large"
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomSize()}
            className="text-right text-black focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Display added sizes */}
      {sizes.length > 0 && (
        <div className="space-y-2">
          <Label className="block text-sm text-gray-600 text-right">القياسات المضافة:</Label>
          <div className="flex flex-wrap gap-2 justify-end">
            {sizes.map((size, index) => (
              <div
                key={index}
                className="relative group bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => removeCustomSize(size)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-blue-700">{size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SizesManager;