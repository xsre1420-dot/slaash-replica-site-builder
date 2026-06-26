import { useEffect, useRef } from 'react';

/** Returns a ref that stays true while the component is mounted. */
export function useIsMounted(): { current: boolean } {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}
