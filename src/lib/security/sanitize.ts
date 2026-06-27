/**
 * Phase 14: Input sanitization — XSS prevention for user-generated content
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);

export const stripScriptTags = (input: string): string =>
  input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

export const sanitizeText = (input: string, maxLength = 5000): string =>
  escapeHtml(stripScriptTags(input.trim())).slice(0, maxLength);

export const sanitizeSlug = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

export const isValidPhone = (phone: string): boolean =>
  /^[\d\s+()-]{7,20}$/.test(phone);
