import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeSlug, sanitizeText } from '@/lib/security/sanitize';
import { parseStoreSlugFromHostname } from '@/lib/tenant/subdomain';

describe('sanitize', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("x")</script>')).not.toContain('<script>');
  });

  it('sanitizes slug', () => {
    expect(sanitizeSlug('My Store!')).toBe('my-store');
  });

  it('strips scripts from text', () => {
    expect(sanitizeText('hello<script>x</script>world')).toBe('helloworld');
  });
});

describe('subdomain', () => {
  it('parses store slug from subdomain', () => {
    expect(parseStoreSlugFromHostname('mystore.example.com')).toBe('mystore');
  });

  it('ignores reserved subdomains', () => {
    expect(parseStoreSlugFromHostname('www.example.com')).toBeNull();
  });

  it('returns null for localhost', () => {
    expect(parseStoreSlugFromHostname('localhost')).toBeNull();
  });
});
