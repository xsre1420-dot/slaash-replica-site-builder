import { callReadRpc } from '@/lib/readWrite/readClient';
import { callWriteRpc } from '@/lib/readWrite/writeClient';
import { supabase } from '@/integrations/supabase/client';
import { isSchemaColumnError } from '@/lib/productUpdateUtils';
import { cache, CacheTTL } from '@/lib/cache';

export type PlatformHealthChecks = {
  storefront: boolean;
  checkout: boolean;
  merchant_catalog: boolean;
  publish: boolean;
  reviews: boolean;
  statistics?: boolean;
  bootstrap?: boolean;
  storage?: boolean;
};

export type PlatformHealthResult = {
  ok: boolean;
  schemaVersion: number;
  requiredVersion: number;
  missing: string[];
  checks: PlatformHealthChecks;
  message: 'ok' | 'migration_required' | 'schema_version_outdated' | 'connection_error' | 'unknown';
  userMessage: string;
  actionHint: string;
};

const CACHE_KEY = 'platform:health';

const defaultChecks = (): PlatformHealthChecks => ({
  storefront: false,
  checkout: false,
  merchant_catalog: false,
  publish: false,
  reviews: false,
});

const buildUserFacing = (
  message: PlatformHealthResult['message'],
  missing: string[]
): Pick<PlatformHealthResult, 'userMessage' | 'actionHint'> => {
  if (message === 'ok') {
    return {
      userMessage: 'الربط مع قاعدة البيانات يعمل بشكل صحيح.',
      actionHint: '',
    };
  }

  if (message === 'connection_error') {
    return {
      userMessage: 'تعذر الاتصال بقاعدة البيانات. تحقق من إعدادات Supabase في ملف .env',
      actionHint: 'راجع VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY ثم أعد تشغيل التطبيق.',
    };
  }

  const missingCount = missing.length;
  return {
    userMessage:
      missingCount > 0
        ? `قاعدة البيانات غير متزامنة مع المنصة (${missingCount} عنصر ناقص). بعض الميزات لن تعمل حتى تطبيق التحديثات.`
        : 'إصدار مخطط قاعدة البيانات قديم. يجب تطبيق migrations على Supabase.',
    actionHint:
      'من مجلد المشروع شغّل: npm run db:deploy — أو انسخ ملفات supabase/migrations/20260616*.sql إلى Supabase SQL Editor بالترتيب.',
  };
};

const parseRpcHealth = (data: Record<string, unknown>): PlatformHealthResult => {
  const missing = Array.isArray(data.missing)
    ? (data.missing as string[])
    : [];

  const checksRaw = (data.checks as Record<string, boolean>) || {};
  const message = (data.message as PlatformHealthResult['message']) || 'unknown';

  const result: PlatformHealthResult = {
    ok: Boolean(data.ok) || message === 'ok',
    schemaVersion: Number(data.schema_version ?? 0),
    requiredVersion: Number(data.required_version ?? 27),
    missing,
    checks: {
      storefront: Boolean(checksRaw.storefront),
      checkout: Boolean(checksRaw.checkout),
      merchant_catalog: Boolean(checksRaw.merchant_catalog),
      publish: Boolean(checksRaw.publish),
      reviews: Boolean(checksRaw.reviews),
      statistics: Boolean(checksRaw.statistics),
      bootstrap: Boolean(checksRaw.bootstrap),
      storage: Boolean(checksRaw.storage),
    },
    message,
    ...buildUserFacing(message, missing),
  };

  return result;
};

/** Client-side fallback when platform_health_check RPC is not deployed yet */
async function probePlatformHealthFallback(): Promise<PlatformHealthResult> {
  const missing: string[] = [];

  const { error: settingsError } = await supabase
    .from('store_settings')
    .select('store_slug, owner_id')
    .limit(1);

  if (settingsError) {
    if (/JWT|Invalid API key|fetch/i.test(settingsError.message)) {
      return {
        ok: false,
        schemaVersion: 0,
        requiredVersion: 27,
        missing: ['connection'],
        checks: defaultChecks(),
        message: 'connection_error',
        ...buildUserFacing('connection_error', []),
      };
    }
    missing.push('table:store_settings');
  }

  const productSelectAttempts = [
    'id, is_active, archived_at, variants, stock_quantity',
    'id, is_active, stock_quantity',
    'id, is_active',
  ];

  let productsOk = false;
  for (const select of productSelectAttempts) {
    const { error } = await supabase.from('products').select(select).limit(1);
    if (!error) {
      productsOk = true;
      break;
    }
    if (!isSchemaColumnError(error.message)) break;
  }

  if (!productsOk) missing.push('column:products.catalog');

  const rpcProbes: Array<{ name: string; key: keyof PlatformHealthChecks; args: Record<string, unknown> }> = [
    { name: 'get_owner_products_page', key: 'merchant_catalog', args: { p_owner_id: '00000000-0000-0000-0000-000000000000', p_limit: 1, p_offset: 0 } },
    { name: 'get_store_products_page', key: 'storefront', args: { p_slug: 'health-probe', p_limit: 1, p_cursor: '', p_category: '', p_search: '' } },
    { name: 'create_order_with_stock_deduction', key: 'checkout', args: {} },
    { name: 'publish_owner_product', key: 'publish', args: { p_product_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'get_merchant_product_reviews', key: 'reviews', args: { p_product_id: '00000000-0000-0000-0000-000000000000' } },
  ];

  const checks = defaultChecks();

  for (const probe of rpcProbes) {
    try {
      const { error } = await callReadRpc(probe.name, probe.args);
      if (!error) {
        checks[probe.key] = true;
        continue;
      }
      const msg = error.toLowerCase();
      if (
        msg.includes('could not find the function') ||
        msg.includes('schema cache') ||
        msg.includes('does not exist')
      ) {
        missing.push(`function:${probe.name}`);
      } else {
        checks[probe.key] = true;
      }
    } catch {
      missing.push(`function:${probe.name}`);
    }
  }

  const message: PlatformHealthResult['message'] =
    missing.length > 0 ? 'migration_required' : 'schema_version_outdated';

  return {
    ok: missing.length === 0 && Object.values(checks).every(Boolean),
    schemaVersion: 0,
    requiredVersion: 27,
    missing,
    checks,
    message,
    ...buildUserFacing(message, missing),
  };
}

export async function fetchPlatformHealth(force = false): Promise<PlatformHealthResult> {
  if (!force) {
    const cached = cache.get<PlatformHealthResult>(CACHE_KEY);
    if (cached) return cached;
  }

  try {
    const { data, error } = await callReadRpc<Record<string, unknown>>('platform_health_check');

    if (!error && data && typeof data === 'object') {
      const parsed = parseRpcHealth(data as Record<string, unknown>);
      cache.set(CACHE_KEY, parsed, CacheTTL.SHORT, CacheTTL.STALE);
      return parsed;
    }

    if (error && /could not find the function/i.test(error)) {
      const fallback = await probePlatformHealthFallback();
      cache.set(CACHE_KEY, fallback, CacheTTL.SHORT, CacheTTL.STALE);
      return fallback;
    }
  } catch {
    /* fall through */
  }

  const fallback = await probePlatformHealthFallback();
  cache.set(CACHE_KEY, fallback, CacheTTL.SHORT, CacheTTL.STALE);
  return fallback;
};

export const invalidatePlatformHealthCache = (): void => {
  cache.del(CACHE_KEY);
};
