
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { useState } from "react";

interface SizesManagerProps {
  sizes: string[];
  onSizesChange: (sizes: string[]) => void;
}

const SizesManager = ({ sizes, onSizesChange }: SizesManagerProps) => {
  const [newSize, setNewSize] = useState("");

  const addSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      onSizesChange([...sizes, newSize.trim()]);
      setNewSize("");
    }
  };

  const removeSize = (sizeToRemove: string) => {
    onSizesChange(sizes.filter(size => size !== sizeToRemove));
  };

  return (
    <div className="space-y-4">
      <Label className="block text-dark-green text-right">القياسات المتوفرة (اختياري)</Label>
      
      {/* Add new size */}
      <div className="flex gap-2">
        <Button 
          type="button"
          onClick={addSize}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Input
          type="text"
          placeholder="أدخل القياس (مثل: صغير، متوسط، كبير)"
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addSize()}
          className="text-right text-dark-green"
        />
      </div>

      {/* Display existing sizes with modern design */}
      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {sizes.map((size, index) => (
            <div
              key={index}
              className="relative flex items-center bg-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-dark-green border-2 border-gray-200 hover:border-primary transition-colors"
            >
              <button
                type="button"
                onClick={() => removeSize(size)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              <span>{size}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SizesManager;
