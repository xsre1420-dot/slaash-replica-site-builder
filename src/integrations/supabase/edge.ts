/**
 * Centralized Supabase Edge Function invoke — correlation IDs, telemetry, normalized errors.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger, buildCorrelationHeaders, newRequestId } from '@/lib/observability';
import { recordHttpRequest } from '@/lib/monitoring/instrumentation';
import { traceSpan } from '@/lib/tracing/spanEngine';

export type EdgeInvokeResult<T> = {
  data: T | null;
  error: string | null;
  /** Raw Response when Supabase invoke fails with non-2xx (body may still hold JSON). */
  errorContext?: Response;
  requestId: string;
};

export type EdgeInvokeOptions = {
  timeoutMs?: number;
};

export async function callSupabaseEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  options: EdgeInvokeOptions = {}
): Promise<EdgeInvokeResult<T>> {
  const requestId = newRequestId();
  const started = Date.now();

  return traceSpan(`edge.${name}`, async (span) => {
    span.setAttribute('edgeFunction', name);
    span.setStage('edge');

    const controller = options.timeoutMs ? new AbortController() : undefined;
    const timeout =
      options.timeoutMs && controller
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : null;

    try {
      const { data, error } = await supabase.functions.invoke(name, {
        body,
        headers: buildCorrelationHeaders(requestId),
      });

      const durationMs = Date.now() - started;
      recordHttpRequest({
        method: 'POST',
        path: `/functions/v1/${name}`,
        status: error ? 500 : 200,
        durationMs,
      });

      if (error) {
        const fnError = error as { message?: string; context?: Response };
        const message = fnError.message ?? String(error);
        logger.debug('edge.error', {
          name,
          requestId,
          durationMs,
          error: message,
          hasData: data != null,
        });
        return {
          data: (data as T) ?? null,
          error: message,
          errorContext: fnError.context,
          requestId,
        };
      }

      logger.debug('edge.ok', { name, requestId, durationMs });
      return { data: data as T, error: null, requestId };
    } catch (err) {
      const durationMs = Date.now() - started;
      const message = err instanceof Error ? err.message : 'edge_invoke_failed';
      recordHttpRequest({
        method: 'POST',
        path: `/functions/v1/${name}`,
        status: 500,
        durationMs,
      });
      return { data: null, error: message, requestId };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  });
}
