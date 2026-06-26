import { memo } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CartDrawer from '@/components/CartDrawer';
import { useCartState } from '@/context/CartContext';
import { getCheckoutPath } from '@/lib/storefrontPaths';

interface StoreCartHeaderButtonProps {
  storeSlug?: string;
}

export const StoreCartHeaderButton = memo(function StoreCartHeaderButton({
  storeSlug,
}: StoreCartHeaderButtonProps) {
  const { cartCount } = useCartState();

  return (
    <CartDrawer storeSlug={storeSlug}>
      <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
        <ShoppingCart className="w-5 h-5 text-foreground" />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold animate-scale-in">
            {cartCount}
          </span>
        )}
      </button>
    </CartDrawer>
  );
});

interface StoreFixedCheckoutBarProps {
  isTenantMode: boolean;
  storeSlug?: string;
}

export const StoreFixedCheckoutBar = memo(function StoreFixedCheckoutBar({
  isTenantMode,
  storeSlug,
}: StoreFixedCheckoutBarProps) {
  const { cartCount, cartTotal } = useCartState();
  const navigate = useNavigate();

  if (cartCount <= 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent safe-area-bottom">
      <button
        type="button"
        onClick={() => navigate(getCheckoutPath(isTenantMode ? storeSlug : null))}
        className="w-full max-w-3xl mx-auto block"
      >
        <div className="bg-primary rounded-2xl transition-colors">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-primary-foreground" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ring-2 ring-primary">
                  {cartCount}
                </span>
              </div>
              <span className="text-sm font-bold text-primary-foreground">
                {cartTotal.toLocaleString()} د.ع
              </span>
            </div>
            <span className="text-sm font-bold text-primary-foreground">إتمام الطلب ←</span>
          </div>
        </div>
      </button>
    </div>
  );
});
