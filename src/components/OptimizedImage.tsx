import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import {
  buildResponsiveImageSources,
  type MediaDeliveryVariant,
} from '@/utils/cdnMediaUtils';
import { isImageUrlLoaded, markImageUrlLoaded } from '@/utils/imageLoadCache';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  fallbackSrc?: string;
  blurPlaceholder?: boolean;
  /** CDN variant — thumbnail for grids/cart, display for hero/detail */
  variant?: MediaDeliveryVariant;
  /** Enable srcSet for Supabase storage assets */
  responsive?: boolean;
  sizes?: string;
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
  fetchPriority,
  fallbackSrc = FALLBACK_IMAGE,
  blurPlaceholder = true,
  variant = 'display',
  responsive = true,
  sizes,
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const sources = useMemo(
    () =>
      responsive
        ? buildResponsiveImageSources(src, { variant, sizes })
        : { src: buildResponsiveImageSources(src, { variant }).src },
    [src, variant, responsive, sizes]
  );

  const [loaded, setLoaded] = useState(() => isImageUrlLoaded(sources.src));
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(sources.src);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fellBackToFullRef = useRef(false);
  const prevSourcesSrcRef = useRef(sources.src);

  useEffect(() => {
    if (prevSourcesSrcRef.current === sources.src) return;
    prevSourcesSrcRef.current = sources.src;
    setError(false);
    setCurrentSrc(sources.src);
    retriesRef.current = 0;
    fellBackToFullRef.current = false;
    setLoaded(isImageUrlLoaded(sources.src));
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [sources.src]);

  const handleLoad = useCallback(() => {
    markImageUrlLoaded(currentSrc);
    setLoaded(true);
    setError(false);
    onLoad?.();
  }, [currentSrc, onLoad]);

  const handleError = useCallback(() => {
    if (
      variant === 'thumbnail' &&
      !fellBackToFullRef.current &&
      sources.src !== src &&
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
        const base = fellBackToFullRef.current ? src : sources.src;
        const separator = base.includes('?') ? '&' : '?';
        setCurrentSrc(`${base}${separator}_r=${retriesRef.current}`);
      }, RETRY_DELAY * retriesRef.current);
    } else {
      setError(true);
      setCurrentSrc(fallbackSrc);
      onError?.();
    }
  }, [src, sources.src, variant, fallbackSrc, onError]);

  const imgStyle =
    width && height ? ({ width, height } as const) : undefined;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={imgStyle}
    >
      {blurPlaceholder && !loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden />
      )}
      <img
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        {...(fetchPriority ? { fetchPriority } : {})}
        {...(sources.srcSet ? { srcSet: sources.srcSet, sizes: sources.sizes } : {})}
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
