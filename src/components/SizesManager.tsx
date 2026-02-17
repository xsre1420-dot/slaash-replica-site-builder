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
      <Label className="block text-foreground text-right font-medium">القياسات المتوفرة</Label>
      
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button 
            type="button"
            onClick={addCustomSize}
            size="icon"
            variant="outline"
            className="rounded-xl border-border hover:bg-accent flex-shrink-0 h-10 w-10"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Input
            type="text"
            placeholder="مثال: XL أو 42 أو Large"
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
            className="text-right rounded-xl border-border focus:border-ring"
          />
        </div>
      </div>

      {sizes.length > 0 && (
        <div className="space-y-2">
          <Label className="block text-sm text-muted-foreground text-right">القياسات المضافة:</Label>
          <div className="flex flex-wrap gap-2 justify-end">
            {sizes.map((size, index) => (
              <div
                key={index}
                className="bg-accent border border-border rounded-xl px-3 py-1.5 flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => removeCustomSize(size)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-medium text-foreground">{size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SizesManager;
