import { useEffect, useRef, useState, type RefObject } from 'react';

/** Fire once when the element enters the viewport (lazy-load below-the-fold sections). */
export function useInView<T extends HTMLElement>(
  options?: IntersectionObserverInit
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px', threshold: 0.01, ...options }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, options?.root, options?.rootMargin, options?.threshold]);

  return [ref, inView];
}
