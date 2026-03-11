import { useState, useCallback, useRef, useEffect, memo } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fallbackSrc?: string;
  blurPlaceholder?: boolean;
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
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const retriesRef = useRef(0);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setCurrentSrc(src);
    retriesRef.current = 0;
  }, [src]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (retriesRef.current < MAX_RETRIES) {
      retriesRef.current += 1;
      setTimeout(() => {
        const separator = src.includes('?') ? '&' : '?';
        setCurrentSrc(`${src}${separator}_r=${retriesRef.current}`);
      }, RETRY_DELAY * retriesRef.current);
    } else {
      setError(true);
      setCurrentSrc(fallbackSrc);
      onError?.();
    }
  }, [src, fallbackSrc, onError]);

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
