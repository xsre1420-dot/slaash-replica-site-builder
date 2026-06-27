import { supabase } from '@/integrations/supabase/client';

export async function getStorePublicSlug(ownerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('store_settings')
    .select('store_slug')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const slug = data?.store_slug?.trim().toLowerCase();
  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    return slug;
  }

  const { data: storeRow } = await supabase
    .from('stores')
    .select('store_slug')
    .eq('user_id', ownerId)
    .maybeSingle();

  const storeSlug = storeRow?.store_slug?.trim().toLowerCase();
  if (storeSlug && /^[a-z0-9-]+$/.test(storeSlug)) {
    return storeSlug;
  }

  return null;
}

export function buildStorePublicUrl(slug: string): string {
  return `${window.location.origin}/store/${slug}`;
}

export async function copyStorePublicUrl(ownerId: string): Promise<string | null> {
  const slug = await getStorePublicSlug(ownerId);
  if (!slug) return null;
  const url = buildStorePublicUrl(slug);
  await navigator.clipboard.writeText(url);
  return url;
}
