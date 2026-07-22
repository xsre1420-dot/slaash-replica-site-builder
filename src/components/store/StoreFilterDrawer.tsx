import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

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
          <button
            type="button"
            className={cn(
              'sf-pill text-xs sm:text-sm',
              activeFilterCount > 0 ? 'sf-pill-active' : 'sf-pill-inactive'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2.25} />
            فلتر
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[380px] font-arabic bg-background border-border/50">
        <SheetHeader className="text-right pb-6 border-b border-border/40">
          <SheetTitle className="text-xl font-bold text-foreground">تصفية المنتجات</SheetTitle>
          <p className="text-sm text-muted-foreground font-normal">حدّد نطاق السعر والمقاسات</p>
        </SheetHeader>

        <div className="mt-8 space-y-10">
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground text-right">نطاق السعر</h3>
            <Slider
              value={[priceRange[0], priceRange[1]]}
              min={0}
              max={maxPrice || 1000000}
              step={1000}
              onValueChange={(v) => setPriceRange([v[0], v[1]])}
              className="mt-2"
            />
            <div className="flex justify-between text-sm text-muted-foreground tabular-nums">
              <span>{priceRange[1].toLocaleString('ar-IQ')} د.ع</span>
              <span>{priceRange[0].toLocaleString('ar-IQ')} د.ع</span>
            </div>
          </div>

          {availableSizes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground text-right">المقاسات</h3>
              <div className="flex flex-wrap gap-2 justify-end">
                {availableSizes.map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={cn(
                      'sf-pill text-xs py-2',
                      sizes.includes(size) ? 'sf-pill-active' : 'sf-pill-inactive'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t border-border/40">
            <Button variant="outline" onClick={handleReset} className="flex-1 h-12 rounded-2xl text-sm font-semibold">
              إعادة تعيين
            </Button>
            <Button onClick={handleApply} className="flex-1 h-12 rounded-2xl sf-btn-primary border-0">
              تطبيق الفلتر
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
