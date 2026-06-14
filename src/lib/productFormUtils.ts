export const slugifyProductName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

export const parseTagsInput = (raw: string): string[] =>
  raw
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

export const formatTagsForInput = (tags: string[]): string => tags.join('، ');

export const computeProfit = (price: number, cost?: number) => {
  if (!cost || cost <= 0 || price <= 0) return null;
  const profit = price - cost;
  const margin = Math.round((profit / price) * 100);
  return { profit, margin };
};

export const formatDisplayPrice = (p: string): string => {
  if (!p) return '';
  const n = parseFloat(p.replace(/,/g, ''));
  if (isNaN(n) || n === 0) return '';
  return n.toLocaleString('en-US');
};
