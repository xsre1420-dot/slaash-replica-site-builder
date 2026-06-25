import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import {
  resolveMediaDeliveryUrl,
  type MediaDeliveryVariant,
} from '@/utils/cdnMediaUtils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fallbackSrc?: string;
  blurPlaceholder?: boolean;
  /** CDN variant — thumbnail for grids/cart, display for hero/detail */
  variant?: MediaDeliveryVariant;
  onLoad?: () => void;
  onError?: () => void;
}

const FALLBACK_IMAGE = '/placeholder.svg';
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const OptimizedImage = memo(({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  fallbackSrc = FALLBACK_IMAGE,
  blurPlaceholder = true,
  variant = 'display',
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const deliverySrc = useMemo(
    () => resolveMediaDeliveryUrl(src, { variant }),
    [src, variant]
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(deliverySrc);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fellBackToFullRef = useRef(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setCurrentSrc(deliverySrc);
    retriesRef.current = 0;
    fellBackToFullRef.current = false;
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [deliverySrc]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (
      variant === 'thumbnail' &&
      !fellBackToFullRef.current &&
      deliverySrc !== src &&
      src?.trim()
    ) {
      fellBackToFullRef.current = true;
      setCurrentSrc(src);
      return;
    }
    if (retriesRef.current < MAX_RETRIES) {
      retriesRef.current += 1;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const base = fellBackToFullRef.current ? src : deliverySrc;
        const separator = base.includes('?') ? '&' : '?';
        setCurrentSrc(`${base}${separator}_r=${retriesRef.current}`);
      }, RETRY_DELAY * retriesRef.current);
    } else {
      setError(true);
      setCurrentSrc(fallbackSrc);
      onError?.();
    }
  }, [src, deliverySrc, variant, fallbackSrc, onError]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {blurPlaceholder && !loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${error ? 'object-contain p-4' : 'object-cover'}`}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
