import { memo } from 'react';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
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
      <button type="button" className="sf-icon-btn" aria-label="سلة التسوق">
        <ShoppingCart className="w-5 h-5" strokeWidth={2} />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold px-1 shadow-sm ring-2 ring-background">
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
    <div className="sf-sticky-bar">
      <button
        type="button"
        onClick={() => navigate(getCheckoutPath(isTenantMode ? storeSlug : null))}
        className="sf-container block"
      >
        <div className="sf-btn-primary w-full h-14 rounded-xl justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
              <ShoppingCart className="w-4 h-4" strokeWidth={2.25} />
              <span className="absolute -top-1.5 -right-1.5 bg-background text-primary rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold">
                {cartCount}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-primary-foreground/80">المجموع</p>
              <p className="text-base font-bold tabular-nums">{cartTotal.toLocaleString('ar-IQ')} د.ع</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-sm font-bold">
            إتمام الطلب
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
          </span>
        </div>
      </button>
    </div>
  );
});
