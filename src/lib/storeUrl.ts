import { supabase } from '@/integrations/supabase/client';export async function getStorePublicSlug(
  ownerId: string,
  fallbackUsername?: string
): Promise<string | null> {
  const { data } = await supabase
    .from('store_settings')
    .select('store_slug')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const slug = data?.store_slug?.trim().toLowerCase();
  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    return slug;
  }

  if (fallbackUsername) {
    return fallbackUsername.trim().toLowerCase();
  }

  return null;
}

export function buildStorePublicUrl(slug: string): string {
  return `${window.location.origin}/store/${slug}`;
}

export async function copyStorePublicUrl(ownerId: string, fallbackUsername?: string): Promise<string | null> {
  const slug = await getStorePublicSlug(ownerId, fallbackUsername);
  if (!slug) return null;
  const url = buildStorePublicUrl(slug);
  await navigator.clipboard.writeText(url);
  return url;
}
