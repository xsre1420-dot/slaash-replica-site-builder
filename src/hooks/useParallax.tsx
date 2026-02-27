import { useEffect, useRef, useState, useCallback } from "react";

export function useParallax(factor = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrolled = window.innerHeight - rect.top;
    if (scrolled > 0 && rect.bottom > 0) {
      setOffset(scrolled * factor);
    }
  }, [factor]);

  useEffect(() => {
    let rafId: number;
    const onScroll = () => {
      rafId = requestAnimationFrame(handleScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [handleScroll]);

  return { ref, offset };
}
