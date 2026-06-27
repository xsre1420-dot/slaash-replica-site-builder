import { useEffect } from 'react';

export interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product';
  price?: number;
  currency?: string;
  storeName?: string;
}

const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
};

const upsertLink = (rel: string, href: string) => {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
};

/**
 * Phase 13: SEO — meta tags + Open Graph + JSON-LD structured data
 */
const SEOHead = ({
  title,
  description = '',
  image,
  url,
  type = 'website',
  price,
  currency = 'IQD',
  storeName,
}: SEOHeadProps) => {
  useEffect(() => {
    document.title = title;

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', type === 'product' ? 'product' : 'website');
    if (image) upsertMeta('property', 'og:image', image);
    if (url) {
      upsertMeta('property', 'og:url', url);
      upsertLink('canonical', url);
    }

    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    if (image) upsertMeta('name', 'twitter:image', image);

    const existing = document.getElementById('seo-jsonld');
    if (existing) existing.remove();

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': type === 'product' ? 'Product' : 'WebSite',
      name: title,
      description,
    };

    if (type === 'product' && price != null) {
      jsonLd.offers = {
        '@type': 'Offer',
        price: price,
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
      };
      if (storeName) jsonLd.brand = { '@type': 'Brand', name: storeName };
    }

    if (image) jsonLd.image = image;

    const script = document.createElement('script');
    script.id = 'seo-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      document.getElementById('seo-jsonld')?.remove();
    };
  }, [title, description, image, url, type, price, currency, storeName]);

  return null;
};

export default SEOHead;
