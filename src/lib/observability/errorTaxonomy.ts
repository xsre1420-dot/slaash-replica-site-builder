/**
 * Phase 4 — Standardized error taxonomy for observability.
 */
export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'business_logic'
  | 'database'
  | 'timeout'
  | 'external_api'
  | 'cache'
  | 'background_worker'
  | 'infrastructure'
  | 'unexpected';

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  validation: 'Validation',
  authentication: 'Authentication',
  authorization: 'Authorization',
  business_logic: 'Business Logic',
  database: 'Database',
  timeout: 'Timeout',
  external_api: 'External API',
  cache: 'Cache',
  background_worker: 'Background Worker',
  infrastructure: 'Infrastructure',
  unexpected: 'Unexpected',
};

export type ClassifiedError = {
  category: ErrorCategory;
  code: string;
  message: string;
  retryable: boolean;
  domain?: string;
};

const PATTERNS: Array<{
  category: ErrorCategory;
  test: RegExp;
  code: string;
  retryable?: boolean;
}> = [
  { category: 'timeout', test: /timeout|aborted|deadline|ETIMEDOUT/i, code: 'TIMEOUT', retryable: true },
  {
    category: 'authentication',
    test: /jwt|unauthorized|invalid.*token|401|not authenticated/i,
    code: 'AUTH_FAILED',
  },
  {
    category: 'authorization',
    test: /forbidden|permission|403|not allowed|tenant_row_owned/i,
    code: 'FORBIDDEN',
  },
  { category: 'validation', test: /invalid|required|must be|validation|422/i, code: 'VALIDATION' },
  {
    category: 'database',
    test: /postgres|pgrst|23505|23503|duplicate key|foreign key|connection|pool/i,
    code: 'DATABASE',
    retryable: true,
  },
  { category: 'cache', test: /cache\.|circuit_open|kv\.|redis/i, code: 'CACHE' },
  { category: 'background_worker', test: /background\.|dead_letter|job\.|queue/i, code: 'WORKER' },
  {
    category: 'external_api',
    test: /fetch failed|network|webhook|edge|502|503|504/i,
    code: 'EXTERNAL',
    retryable: true,
  },
  {
    category: 'business_logic',
    test: /stock|coupon|order|inventory|out of|insufficient/i,
    code: 'BUSINESS',
  },
  { category: 'infrastructure', test: /migration_required|schema|health|failover/i, code: 'INFRA' },
];

export function classifyError(
  error: unknown,
  metadata?: { domain?: string; code?: string; hint?: ErrorCategory }
): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const embeddedCode =
    error instanceof Error && 'code' in error ? String((error as { code?: string }).code ?? '') : '';

  if (metadata?.hint) {
    return {
      category: metadata.hint,
      code: metadata.code || embeddedCode || metadata.hint.toUpperCase(),
      message,
      retryable: false,
      domain: metadata.domain,
    };
  }

  for (const p of PATTERNS) {
    if (p.test.test(message) || (embeddedCode && p.test.test(embeddedCode))) {
      return {
        category: p.category,
        code: metadata?.code || embeddedCode || p.code,
        message,
        retryable: p.retryable ?? false,
        domain: metadata?.domain,
      };
    }
  }

  return {
    category: 'unexpected',
    code: metadata?.code || embeddedCode || 'UNEXPECTED',
    message,
    retryable: false,
    domain: metadata?.domain,
  };
}

export function errorCategorySeverity(category: ErrorCategory): 'warn' | 'error' | 'fatal' {
  switch (category) {
    case 'authentication':
    case 'authorization':
    case 'validation':
    case 'business_logic':
    case 'cache':
      return 'warn';
    case 'infrastructure':
      return 'fatal';
    default:
      return 'error';
  }
}
