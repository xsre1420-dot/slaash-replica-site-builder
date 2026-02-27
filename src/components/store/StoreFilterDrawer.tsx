import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";

interface StoreFilterDrawerProps {
  maxPrice: number;
  currentRange: [number, number];
  availableSizes: string[];
  selectedSizes: string[];
  onApply: (range: [number, number], sizes: string[]) => void;
  onReset: () => void;
  activeFilterCount: number;
  children?: React.ReactNode;
}

export default function StoreFilterDrawer({
  maxPrice,
  currentRange,
  availableSizes,
  selectedSizes: initialSizes,
  onApply,
  onReset,
  activeFilterCount,
  children,
}: StoreFilterDrawerProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>(currentRange);
  const [sizes, setSizes] = useState<string[]>(initialSizes);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPriceRange(currentRange);
    setSizes(initialSizes);
  }, [currentRange, initialSizes]);

  const toggleSize = (size: string) => {
    setSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
  };

  const handleApply = () => {
    onApply(priceRange, sizes);
    setOpen(false);
  };

  const handleReset = () => {
    setPriceRange([0, maxPrice]);
    setSizes([]);
    onReset();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilterCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            <SlidersHorizontal className="w-3 h-3" />
            فلتر {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] font-arabic bg-card">
        <SheetHeader>
          <SheetTitle className="text-right text-foreground">تصفية المنتجات</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* Price Range */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground text-right">نطاق السعر</h3>
            <Slider
              value={[priceRange[0], priceRange[1]]}
              min={0}
              max={maxPrice || 1000000}
              step={1000}
              onValueChange={(v) => setPriceRange([v[0], v[1]])}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{priceRange[0].toLocaleString()} د.ع</span>
              <span>{priceRange[1].toLocaleString()} د.ع</span>
            </div>
          </div>

          {/* Sizes */}
          {availableSizes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground text-right">المقاسات</h3>
              <div className="flex flex-wrap gap-2 justify-end">
                {availableSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      sizes.includes(size) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleReset} className="flex-1 rounded-xl">
              إعادة تعيين
            </Button>
            <Button onClick={handleApply} className="flex-1 rounded-xl bg-primary text-primary-foreground">
              تطبيق
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
