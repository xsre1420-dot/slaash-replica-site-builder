/**
 * Phase 4 — Secure defaults registry (headers, CSP, cookies, JWT, sessions).
 */
export const SECURITY_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const;

export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

export const SESSION_DEFAULTS = {
  flowType: 'pkce' as const,
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
  storage: 'localStorage_with_remember_me_option' as const,
};

export const JWT_DEFAULTS = {
  refreshEnabled: true,
  tokenStorage: 'supabase_auth_session',
  neverLogTokens: true,
  redactInErrors: true,
};

export const COOKIE_DEFAULTS = {
  sameSite: 'lax' as const,
  secureInProduction: true,
  httpOnlyNote: 'Supabase auth cookies managed by SDK; session in localStorage when remember me',
};

export const RATE_LIMIT_READINESS = {
  clientLogin: { maxRequests: 8, windowMs: 300_000 },
  clientCheckout: { maxRequests: 5, windowMs: 60_000 },
  serverRpcRateLimits: 'rpc_rate_limits table + edge throttling',
  recommendation: 'Enable WAF/rate limits at CDN for production',
};

export const PASSWORD_HANDLING = {
  minLength: 8,
  recoveryFlow: 'pkce',
  neverLogPasswords: true,
  storage: 'never client-side plaintext',
};

export function getSecureDefaultsManifest() {
  return {
    headers: SECURITY_HEADERS,
    csp: CONTENT_SECURITY_POLICY,
    session: SESSION_DEFAULTS,
    jwt: JWT_DEFAULTS,
    cookies: COOKIE_DEFAULTS,
    rateLimit: RATE_LIMIT_READINESS,
    password: PASSWORD_HANDLING,
    deploymentSource: 'vercel.json + index.html meta (nosniff, referrer)',
  };
}
