/** Strip characters that break PostgREST `.or()` / filter strings */
export const sanitizePostgrestFilterValue = (value: string, maxLen = 80): string =>
  value.replace(/[,()%\\*]/g, '').trim().slice(0, maxLen);

export const escapeIlikePattern = (value: string): string =>
  sanitizePostgrestFilterValue(value).replace(/[_%]/g, '');
