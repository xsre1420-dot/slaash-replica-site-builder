type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  function?: string;
  requestId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export const logStructured = (
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
) => {
  const entry: StructuredLog = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  const line = JSON.stringify(entry);
  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    default:
      console.log(line);
  }
};

export const withEdgeSpan = async <T>(
  name: string,
  fn: () => Promise<T>,
  fields: Record<string, unknown> = {}
): Promise<T> => {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  try {
    const result = await fn();
    logStructured('info', `${name}.ok`, {
      ...fields,
      requestId,
      durationMs: Math.round(performance.now() - started),
    });
    return result;
  } catch (error) {
    logStructured('error', `${name}.failed`, {
      ...fields,
      requestId,
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
