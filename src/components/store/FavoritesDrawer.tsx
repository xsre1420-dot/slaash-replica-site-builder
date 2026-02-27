import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Heart, ShoppingCart, Plus } from "lucide-react";
import { Product } from "@/types";
import { Button } from "@/components/ui/button";

interface FavoritesDrawerProps {
  favorites: Product[];
  count: number;
  onAddToCart: (product: Product) => void;
  onRemoveFavorite: (id: string) => void;
  onViewProduct: (id: string) => void;
  children?: React.ReactNode;
}

export default function FavoritesDrawer({ favorites, count, onAddToCart, onRemoveFavorite, onViewProduct, children }: FavoritesDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
            <Heart className="w-5 h-5 text-foreground" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                {count}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] sm:w-[400px] font-arabic bg-card">
        <SheetHeader>
          <SheetTitle className="text-right text-foreground flex items-center justify-end gap-2">
            المفضلة ({count})
            <Heart className="w-5 h-5 text-destructive fill-current" />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col h-[calc(100vh-120px)]">
          {favorites.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Heart className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">لا توجد مفضلات</p>
              <p className="text-sm mt-1">اضغط على ❤️ لإضافة منتجات</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {favorites.map((product) => (
                <div key={product.id} className="flex gap-3 bg-muted/50 rounded-xl p-3 cursor-pointer hover:bg-muted transition-colors" onClick={() => onViewProduct(product.id)}>
                  <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground text-right truncate">{product.name}</h4>
                    <p className="text-sm font-bold text-primary text-right mt-1">{product.price.toLocaleString()} د.ع</p>
                    <div className="flex items-center justify-between mt-2">
                      <button onClick={(e) => { e.stopPropagation(); onRemoveFavorite(product.id); }} className="text-destructive hover:text-destructive/80 p-1">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <Button size="sm" className="h-7 text-[10px] rounded-lg bg-primary text-primary-foreground" onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}>
                        <Plus className="w-3 h-3 ml-0.5" /> أضف للسلة
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
