import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isRecoveryUrl } from '@/lib/authUtils';

export type PasswordRecoveryMode = 'checking' | 'request' | 'update';

export function usePasswordRecoveryMode() {
  const [mode, setMode] = useState<PasswordRecoveryMode>('checking');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyRecovery = () => {
      if (!cancelled) {
        setMode('update');
        setSessionReady(true);
      }
    };

    if (isRecoveryUrl()) {
      applyRecovery();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (isRecoveryUrl() && session)) {
        applyRecovery();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (isRecoveryUrl() && session) {
        applyRecovery();
      } else if (mode === 'checking' && !isRecoveryUrl()) {
        setMode('request');
        setSessionReady(!!session);
      } else if (mode === 'checking') {
        setMode(isRecoveryUrl() ? 'update' : 'request');
        setSessionReady(!!session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { mode, sessionReady, isRecovery: mode === 'update' };
}
