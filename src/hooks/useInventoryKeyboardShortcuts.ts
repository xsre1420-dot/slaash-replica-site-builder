import { useEffect, RefObject } from 'react';

interface UseInventoryKeyboardShortcutsOptions {
  enabled?: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onFocusSearch?: () => void;
  onBulkRestock?: () => void;
  onExport?: () => void;
}

export function useInventoryKeyboardShortcuts({
  enabled = true,
  searchInputRef,
  onFocusSearch,
  onBulkRestock,
  onExport,
}: UseInventoryKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === '/' && !typing) {
        e.preventDefault();
        if (searchInputRef?.current) {
          searchInputRef.current.focus();
        } else {
          onFocusSearch?.();
        }
      }

      if (typing) return;

      if ((e.key === 'r' || e.key === 'R') && onBulkRestock) {
        e.preventDefault();
        onBulkRestock();
      }

      if ((e.key === 'e' || e.key === 'E') && (e.ctrlKey || e.metaKey) && onExport) {
        e.preventDefault();
        onExport();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, searchInputRef, onFocusSearch, onBulkRestock, onExport]);
}
