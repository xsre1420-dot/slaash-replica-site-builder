import { buildEventBase } from './context';
import { enqueueEvent } from './reporter';
import { logger } from './logger';
import { timing } from './metrics';

import { generateUUID } from '@/lib/uuid';

const generateSpanId = () => generateUUID().slice(0, 8);

export interface SpanHandle {
  spanId: string;
  setAttribute: (key: string, value: unknown) => void;
}

export const withSpan = async <T>(
  name: string,
  fn: (span: SpanHandle) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> => {
  const base = buildEventBase();
  const spanId = generateSpanId();
  const attrs = { ...attributes };
  const started = performance.now();

  const span: SpanHandle = {
    spanId,
    setAttribute: (key, value) => {
      attrs[key] = value;
    },
  };

  try {
    const result = await fn(span);
    const durationMs = performance.now() - started;

    timing(`span.${name}`, durationMs, { status: 'ok' });
    enqueueEvent({
      type: 'span',
      name,
      durationMs,
      status: 'ok',
      spanId,
      attributes: attrs,
      ...base,
    });

    return result;
  } catch (error) {
    const durationMs = performance.now() - started;
    const message = error instanceof Error ? error.message : String(error);

    timing(`span.${name}`, durationMs, { status: 'error' });
    enqueueEvent({
      type: 'span',
      name,
      durationMs,
      status: 'error',
      spanId,
      attributes: attrs,
      error: message,
      ...base,
    });

    logger.error(`Span failed: ${name}`, { spanId, ...attrs }, error);
    throw error;
  }
};
