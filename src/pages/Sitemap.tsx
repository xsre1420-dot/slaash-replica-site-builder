import { useEffect } from 'react';
import { listPublicStoreSlugs } from '@/services/storeService';
import { withRateLimit } from '@/lib/security/rateLimiter';
import { getPublicAppOrigin } from '@/lib/storeUrl';

/**
 * Phase 13: Dynamic sitemap — lists all public store slugs
 * Mount on /sitemap.xml route or call from edge function
 */
export async function generateSitemapXml(baseUrl: string): Promise<string> {
  const stores = await withRateLimit(
    'sitemap:generate',
    { maxRequests: 5, windowMs: 60_000 },
    async () => listPublicStoreSlugs(5000, 0)
  );
  const urls = stores
    .filter((s) => s.store_slug)
    .map((s) => {
      const slug = s.store_slug as string;
      const lastmod = s.updated_at
        ? new Date(s.updated_at as string).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      return `  <url>
    <loc>${baseUrl}/store/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;
}

/** React page that serves sitemap as downloadable XML */
const Sitemap = () => {
  useEffect(() => {
    let cancelled = false;
    const base = getPublicAppOrigin();

    void generateSitemapXml(base).then((xml) => {
      if (cancelled) return;
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      try {
        window.location.replace(url);
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};

export default Sitemap;
