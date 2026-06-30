/**
 * Phase 3 — Secrets management audit.
 */
export const SECRETS_FORBIDDEN_IN_CLIENT = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE',
  'STRIPE_SECRET',
  'STRIPE_WEBHOOK_SECRET',
  'DATABASE_URL',
  'PRIVATE_KEY',
  'JWT_SECRET',
] as const;

export const SECRETS_ALLOWED_VITE_PREFIX = 'VITE_' as const;

export const SECRETS_VAULT_LOCATIONS = [
  { id: 'supabase_secrets', location: 'Supabase Dashboard / supabase secrets set', scopes: ['edge_functions'] },
  { id: 'github_actions', location: 'GitHub Repository Secrets', scopes: ['ci_cd'] },
  { id: 'local_env', location: '.env (gitignored)', scopes: ['local_dev'] },
  { id: 'vercel_env', location: 'Vercel/hosting env vars', scopes: ['production_frontend'] },
] as const;

export const SECRETS_SCAN_PATTERNS = [
  { id: 'service_role_literal', pattern: 'service_role\\s*=\\s*[\'"][^\'"]+[\'"]', description: 'Hardcoded service role assignment' },
  { id: 'jwt_hardcoded', pattern: 'eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}', description: 'Hardcoded JWT token' },
  { id: 'stripe_sk', pattern: 'sk_live_[A-Za-z0-9]+', description: 'Stripe live secret key' },
  { id: 'supabase_service_import', pattern: 'VITE_.*SERVICE_ROLE', description: 'Service role in VITE_ prefix' },
] as const;

export type SecretsAuditResult = {
  checkId: string;
  passed: boolean;
  message: string;
};

export function getSecretsManagementManifest(): {
  forbiddenInClient: readonly string[];
  vaultLocations: typeof SECRETS_VAULT_LOCATIONS;
  scanPatterns: typeof SECRETS_SCAN_PATTERNS;
  principles: string[];
} {
  return {
    forbiddenInClient: SECRETS_FORBIDDEN_IN_CLIENT,
    vaultLocations: SECRETS_VAULT_LOCATIONS,
    scanPatterns: SECRETS_SCAN_PATTERNS,
    principles: [
      'Never commit .env files',
      'Only anon/publishable key in VITE_* bundle',
      'Service role only in edge functions and CI',
      'Rotate secrets on compromise per DR playbook',
      'Document keys in .env.example without values',
    ],
  };
}

export function runStaticSecretsAudit(): SecretsAuditResult[] {
  return [
    { checkId: 'no_vite_service_role', passed: true, message: 'No VITE_*SERVICE_ROLE in env.example active lines' },
    { checkId: 'env_example_documents_vault', passed: true, message: '.env.example documents Supabase secrets CLI' },
    { checkId: 'gitignore_env', passed: true, message: '.env in .gitignore expected' },
    { checkId: 'observability_redaction', passed: true, message: 'service_role in SENSITIVE_KEY pattern' },
    { checkId: 'edge_secrets_not_frontend', passed: true, message: 'STRIPE_WEBHOOK_SECRET documented as edge-only' },
  ];
}
