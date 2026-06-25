import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, { message: 'VITE_SUPABASE_PUBLISHABLE_KEY is missing or invalid' }),
  VITE_SUPABASE_PROJECT_ID: z.string().optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_OBSERVABILITY_WEBHOOK_URL: z.union([z.string().url(), z.literal('')]).optional(),
  /** Never enable client-side webhook posting in production unless you accept URL exposure. */
  VITE_OBSERVABILITY_CLIENT_ENABLED: z.enum(['true', 'false', '0', '1']).optional(),
  VITE_OBSERVABILITY_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  VITE_FAILOVER_SUPABASE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  /** Transaction pooler — use project HTTPS URL; client sends x-connection-mode: pooler */
  VITE_SUPABASE_POOLER_URL: z.union([z.string().url(), z.literal('')]).optional(),
  /** Edge function URL override; defaults to {SUPABASE_URL}/functions/v1/get-store-products */
  VITE_STOREFRONT_EDGE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  /** When true, routes public storefront reads through the edge function (shared HTTP cache). */
  VITE_STOREFRONT_EDGE_ENABLED: z.enum(['true', 'false', '0', '1']).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

const raw = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined,
  VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined,
  VITE_APP_ENV: (import.meta.env.VITE_APP_ENV as AppEnv['VITE_APP_ENV']) || 'development',
  VITE_OBSERVABILITY_WEBHOOK_URL: import.meta.env.VITE_OBSERVABILITY_WEBHOOK_URL as string | undefined,
  VITE_OBSERVABILITY_CLIENT_ENABLED: import.meta.env.VITE_OBSERVABILITY_CLIENT_ENABLED as string | undefined,
  VITE_OBSERVABILITY_SAMPLE_RATE: import.meta.env.VITE_OBSERVABILITY_SAMPLE_RATE as number | undefined,
  VITE_FAILOVER_SUPABASE_URL: import.meta.env.VITE_FAILOVER_SUPABASE_URL as string | undefined,
  VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  VITE_SUPABASE_POOLER_URL: import.meta.env.VITE_SUPABASE_POOLER_URL as string | undefined,
  VITE_STOREFRONT_EDGE_URL: import.meta.env.VITE_STOREFRONT_EDGE_URL as string | undefined,
  VITE_STOREFRONT_EDGE_ENABLED: import.meta.env.VITE_STOREFRONT_EDGE_ENABLED as string | undefined,
};

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  const message = `Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and set required values.`;

  if (import.meta.env.PROD) {
    throw new Error(message);
  }

  console.error(`[env] ${message}`);
}

export const env: AppEnv = parsed.success
  ? parsed.data
  : {
      VITE_SUPABASE_URL: raw.VITE_SUPABASE_URL || 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: raw.VITE_SUPABASE_PUBLISHABLE_KEY || 'missing-anon-key',
      VITE_SUPABASE_PROJECT_ID: raw.VITE_SUPABASE_PROJECT_ID,
      VITE_APP_ENV: raw.VITE_APP_ENV || 'development',
      VITE_OBSERVABILITY_WEBHOOK_URL: raw.VITE_OBSERVABILITY_WEBHOOK_URL || undefined,
      VITE_OBSERVABILITY_SAMPLE_RATE: raw.VITE_OBSERVABILITY_SAMPLE_RATE,
      VITE_FAILOVER_SUPABASE_URL: raw.VITE_FAILOVER_SUPABASE_URL || undefined,
      VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY: raw.VITE_FAILOVER_SUPABASE_PUBLISHABLE_KEY,
    };

export const isProduction = () => env.VITE_APP_ENV === 'production';
export const isStaging = () => env.VITE_APP_ENV === 'staging';

/** Client-side observability webhook is off in production unless explicitly enabled. */
export const isObservabilityClientEnabled = (): boolean => {
  if (env.VITE_OBSERVABILITY_CLIENT_ENABLED === 'true' || env.VITE_OBSERVABILITY_CLIENT_ENABLED === '1') {
    return !!env.VITE_OBSERVABILITY_WEBHOOK_URL;
  }
  if (env.VITE_OBSERVABILITY_CLIENT_ENABLED === 'false' || env.VITE_OBSERVABILITY_CLIENT_ENABLED === '0') {
    return false;
  }
  return !isProduction() && !!env.VITE_OBSERVABILITY_WEBHOOK_URL;
};
