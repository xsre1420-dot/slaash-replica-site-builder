/**
 * Coordinates storefront bundle loads across tenant registry and product hooks.
 * Prevents parallel duplicate load paths from racing before cache is warm.
 */
import { peekInflight } from '@/lib/cache';
import {
  storefrontBundleInflightKey,
  storefrontBundleStampedeKey,
  type StorefrontBundleRequestOptions,
} from '@/lib/storefront/storefrontRpcConfig';
import { getTenantStoreInflight } from '@/lib/tenantStoreInflight';

/** Wait for any in-flight tenant meta or bundle fetch for this slug (no-op if idle). */
export async function awaitStorefrontBundleReady(
  slug: string,
  options: StorefrontBundleRequestOptions = {}
): Promise<void> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return;

  const waits: Promise<unknown>[] = [];
  const stampedeInflight = peekInflight(storefrontBundleStampedeKey(normalized, options));
  const fetchInflight = peekInflight(
    storefrontBundleInflightKey(normalized, options, 'fetch')
  );
  const rpcInflight = peekInflight(storefrontBundleInflightKey(normalized, options, 'rpc'));
  const tenantInflight = getTenantStoreInflight(normalized);

  if (stampedeInflight) waits.push(stampedeInflight);
  if (fetchInflight) waits.push(fetchInflight);
  if (rpcInflight) waits.push(rpcInflight);
  if (tenantInflight) waits.push(tenantInflight);

  if (waits.length === 0) return;
  await Promise.allSettled(waits);
}
