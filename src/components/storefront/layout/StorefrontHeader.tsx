import { Search, BadgeCheck } from 'lucide-react';
import { StoreCartHeaderButton } from '@/components/store/StoreCartChrome';
import { resolveMediaDeliveryUrl } from '@/utils/cdnMediaUtils';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StorefrontHeaderProps {
  storeName: string;
  storeLogo?: string;
  isVerified?: boolean;
  storeSlug?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  scrolled?: boolean;
  /** Override start slot (RTL: right). Defaults to cart button. */
  startAction?: ReactNode;
  /** Override end slot (RTL: left). Defaults to spacer. */
  endAction?: ReactNode;
}

const StorefrontHeader = ({
  storeName,
  storeLogo,
  isVerified,
  storeSlug,
  searchQuery,
  onSearchChange,
  scrolled = false,
  startAction,
  endAction,
}: StorefrontHeaderProps) => (
  <header className={cn('sf-header', scrolled && 'sf-header-scrolled')}>
    <div className="sf-container py-3 sm:py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        {startAction ?? <StoreCartHeaderButton storeSlug={storeSlug} />}

        <div className="flex-1 flex items-center justify-center gap-2.5 min-w-0">
          {storeLogo && (
            <img
              src={resolveMediaDeliveryUrl(storeLogo, { variant: 'thumbnail' })}
              alt=""
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover ring-1 ring-border/40 shrink-0"
              width={40}
              height={40}
              loading="eager"
              decoding="async"
            />
          )}
          <div className="min-w-0 text-center">
            <p className="font-bold text-base sm:text-lg text-foreground truncate flex items-center justify-center gap-1.5 tracking-tight">
              {storeName}
              {isVerified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" strokeWidth={2.25} />}
            </p>
          </div>
        </div>

        {endAction ?? <div className="w-10 sm:w-11 shrink-0" aria-hidden />}
      </div>

      <div className="relative max-w-xl mx-auto w-full">
        <Search
          className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-muted-foreground/70 pointer-events-none"
          strokeWidth={2}
        />
        <input
          type="search"
          placeholder="ابحث عن منتج..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sf-search"
          aria-label="بحث في المتجر"
        />
      </div>
    </div>
  </header>
);

export default StorefrontHeader;
