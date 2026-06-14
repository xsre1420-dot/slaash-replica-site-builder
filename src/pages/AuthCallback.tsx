import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { mapAuthError } from '@/lib/authUtils';

type CallbackState = 'processing' | 'success' | 'error';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = (next: CallbackState, message?: string) => {
      if (cancelled) return;
      if (message) setError(message);
      setState(next);
    };

    const run = async () => {
      try {
        const search = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const code = search.get('code');
        const hashError =
          hash.get('error_description') ||
          search.get('error_description') ||
          hash.get('error') ||
          search.get('error');

        if (hashError) {
          finish('error', mapAuthError(decodeURIComponent(hashError.replace(/\+/g, ' '))));
          window.history.replaceState({}, '', '/auth/callback');
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[auth.callback] exchange failed:', exchangeError.message);
            finish('error', mapAuthError(exchangeError.message));
            return;
          }
          window.history.replaceState({}, '', '/auth/callback');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[auth.callback] getSession failed:', sessionError.message);
          finish('error', mapAuthError(sessionError.message));
          return;
        }

        if (session?.user) {
          finish('success');
          navigate('/builder', { replace: true });
          return;
        }

        finish('error', 'تعذر إكمال تسجيل الدخول. حاول تسجيل الدخول يدوياً.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
        console.error('[auth.callback]', err);
        finish('error', mapAuthError(msg));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state === 'processing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-arabic" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">جاري إكمال تسجيل الدخول…</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-arabic p-6" dir="rtl">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">تعذر إكمال العملية</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/login', { replace: true })} className="rounded-xl">
              تسجيل الدخول
            </Button>
            <Button variant="outline" onClick={() => navigate('/signup', { replace: true })} className="rounded-xl">
              إنشاء حساب
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
