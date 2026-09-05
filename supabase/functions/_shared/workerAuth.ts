import { isProduction } from './env.ts';

const jsonHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  ...extra,
});

/**
 * Authorize background worker edge endpoints.
 * Production: BACKGROUND_WORKER_SECRET is required.
 */
export function authorizeWorker(req: Request): Response | null {
  const configured = (Deno.env.get('BACKGROUND_WORKER_SECRET') || '').trim();

  if (isProduction()) {
    if (!configured) {
      console.error('[security] BACKGROUND_WORKER_SECRET must be set in production');
      return new Response(JSON.stringify({ success: false, error: 'misconfigured' }), {
        status: 503,
        headers: jsonHeaders(),
      });
    }
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${configured}`) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: jsonHeaders(),
      });
    }
    return null;
  }

  if (configured) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${configured}`) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: jsonHeaders(),
      });
    }
  }

  return null;
}
