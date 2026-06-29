/**
 * Sensitive field redaction for structured logs — aligned with edge observability.
 */
const SENSITIVE_KEY =
  /^(password|passwd|secret|token|apikey|api_key|authorization|bearer|cookie|session_token|access_token|refresh_token|credit_card|cvv|ssn|private_key|service_role|anon_key|customer_phone|phone_number)$/i;

const PARTIAL_REDACT_KEYS = /^(email|customer_email)$/i;

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (PARTIAL_REDACT_KEYS.test(key) && typeof value === 'string' && value.includes('@')) {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeLogContext(value as Record<string, unknown>);
  }
  return value;
}

export function sanitizeLogContext(
  context?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export function sanitizeErrorMessage(message: string): string {
  return message.replace(BEARER_PATTERN, 'Bearer [REDACTED]').replace(JWT_PATTERN, '[REDACTED]');
}
