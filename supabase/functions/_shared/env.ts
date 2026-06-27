/** Shared runtime helpers for Supabase Edge Functions. */

export const isProduction = (): boolean =>
  Deno.env.get('ENVIRONMENT') === 'production' ||
  Deno.env.get('DENO_ENV') === 'production' ||
  !!Deno.env.get('DENO_DEPLOYMENT_ID');

export const requireInProduction = (name: string, value: string | undefined): string | null => {
  if (value?.trim()) return value.trim();
  if (isProduction()) {
    console.error(`[security] Required secret/env "${name}" is not set in production`);
    return null;
  }
  console.warn(`[dev] "${name}" not set — using permissive fallback`);
  return null;
};
