import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isRecoveryUrl } from '@/lib/authUtils';

export type PasswordRecoveryMode = 'checking' | 'request' | 'update';

export function usePasswordRecoveryMode() {
  const [mode, setMode] = useState<PasswordRecoveryMode>('checking');

  useEffect(() => {
    let cancelled = false;

    const setUpdateMode = () => {
      if (!cancelled) setMode('update');
    };

    const init = async () => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      if (hash.get('type') === 'recovery' || hash.get('access_token')) {
        setUpdateMode();
        return;
      }

      if (search.has('code')) {
        const code = search.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setUpdateMode();
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session && isRecoveryUrl()) {
        setUpdateMode();
      } else {
        setMode('request');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setUpdateMode();
    });

    void init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { mode, isRecovery: mode === 'update' };
}
