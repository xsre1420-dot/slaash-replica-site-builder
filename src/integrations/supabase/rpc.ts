import { resolveReadEndpoint } from '@/lib/readWrite/readRouter';
import type { ReadRouteDecision } from '@/lib/readWrite/readRouter';
import { env } from '@/lib/env';
import { logger, buildCorrelationHeaders, newRequestId } from '@/lib/observability';
import { classifyError } from '@/lib/observability/errorTaxonomy';
import { traceSpan } from '@/lib/tracing/spanEngine';
import { recordRpcCall, recordRpcReplicaFallback, recordHttpRequest } from '@/lib/monitoring/instrumentation';
import { withCircuitBreaker } from '@/lib/resilience/circuitBreaker';

export type RpcResult<T> = {
  data: T | null;
  error: string | null;
  route?: string;
};

export type RpcCallOptions = {
  /** Force primary DB even for read-classified RPCs (checkout recovery, etc.) */
  forcePrimary?: boolean;
  /** Skip circuit breaker (health probes) */
  skipBreaker?: boolean;
  timeoutMs?: number;
  /** Populated by callReadRpc for observability. */
  readRoute?: ReadRouteDecision;
};

const REPLICA_LABELS = new Set(['read_replica', 'regional_replica']);

function isReplicaLabel(label: string | undefined): boolean {
  return label != null && REPLICA_LABELS.has(label);
}

/** Typed RPC wrapper with read-replica routing + circuit breaker + primary fallback. */
export async function callSupabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options: RpcCallOptions = {}
): Promise<RpcResult<T>> {
  const endpoint = resolveReadEndpoint(fn, { forcePrimary: options.forcePrimary });
  const breakerName = `rpc:${fn}:${endpoint.label}`;

  const execute = async (): Promise<RpcResult<T>> => {
    const controller = new AbortController();
    const timeout = options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;
    const requestId = newRequestId();
    const correlationHeaders = buildCorrelationHeaders(requestId);
    const started = Date.now();

    const emitRpcMetrics = (
      status: 'ok' | 'error',
      durationMs: number,
      errorCategory?: string
    ) => {
      recordRpcCall({
        rpcName: fn,
        durationMs,
        status,
        route: endpoint.label,
        errorCategory,
      });
      recordHttpRequest({
        method: 'POST',
        path: `/rpc/${fn}`,
        status: status === 'ok' ? 200 : 500,
        durationMs,
      });
    };

    logger.debug('rpc.start', {
      rpcName: fn,
      requestId,
      route: endpoint.label,
      readRoute: options.readRoute?.reason,
    });

    return traceSpan(
      `rpc.${fn}`,
      async (span) => {
        span.setAttribute('rpcName', fn);
        span.setAttribute('route', endpoint.label);
        span.setStage('rpc');

        try {
          const res = await fetch(`${endpoint.url}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              ...(endpoint.headers ?? {}),
              ...(env.VITE_SUPABASE_POOLER_URL?.trim() ? { 'x-connection-mode': 'pooler' } : {}),
              ...correlationHeaders,
              apikey: endpoint.key,
              Authorization: `Bearer ${endpoint.key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(args),
          });

          const text = await res.text();
          let data: T | null = null;
          try {
            data = text ? (JSON.parse(text) as T) : null;
          } catch {
            const durationMs = Date.now() - started;
            emitRpcMetrics('error', durationMs, 'validation');
            logger.warn('rpc.complete', {
              rpcName: fn,
              requestId,
              route: endpoint.label,
              durationMs,
              status: 'error',
              errorCategory: 'validation',
            });
            return { data: null, error: text.slice(0, 200) || 'Invalid RPC response', route: endpoint.label };
          }

          if (!res.ok) {
            const errMsg =
              typeof data === 'object' && data && 'message' in (data as object)
                ? String((data as { message?: string }).message)
                : text.slice(0, 200) || `RPC ${fn} failed (${res.status})`;
            const classified = classifyError(errMsg);
            const durationMs = Date.now() - started;
            emitRpcMetrics('error', durationMs, classified.category);
            logger.warn('rpc.complete', {
              rpcName: fn,
              requestId,
              route: endpoint.label,
              durationMs,
              status: 'error',
              errorCategory: classified.category,
              errorCode: classified.code,
              httpStatus: res.status,
            });
            return { data: null, error: errMsg, route: endpoint.label };
          }

          const durationMs = Date.now() - started;
          emitRpcMetrics('ok', durationMs);
          logger.debug('rpc.complete', {
            rpcName: fn,
            requestId,
            route: endpoint.label,
            durationMs,
            status: 'ok',
          });

          return { data, error: null, route: endpoint.label };
        } catch (err) {
          const durationMs = Date.now() - started;
          const message = err instanceof Error ? err.message : 'RPC failed';
          const classified = classifyError(err);
          emitRpcMetrics('error', durationMs, classified.category);
          logger.warn('rpc.complete', {
            rpcName: fn,
            requestId,
            route: endpoint.label,
            durationMs,
            status: 'error',
            errorCategory: classified.category,
            errorCode: classified.code,
            error: message,
          });
          if (options.skipBreaker) throw err;
          return { data: null, error: message, route: endpoint.label };
        }
      },
      { rpcName: fn, route: endpoint.label, stage: 'rpc' }
    ).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  };

  const fallbackToPrimary = async (reason: string, priorError?: string): Promise<RpcResult<T>> => {
    recordRpcReplicaFallback(reason);
    logger.warn('read_replica.fallback_to_primary', {
      rpc: fn,
      from: endpoint.label,
      reason,
      error: priorError,
      readRoute: options.readRoute?.reason,
    });
    return callSupabaseRpc<T>(fn, args, {
      ...options,
      forcePrimary: true,
      skipBreaker: true,
      readRoute: options.readRoute,
    });
  };

  try {
    if (options.skipBreaker) {
      return await execute();
    }

    const result = await withCircuitBreaker(breakerName, execute, {
      failureThreshold: 4,
      openMs: 12_000,
      name: breakerName,
    });

    if (
      !options.forcePrimary &&
      isReplicaLabel(endpoint.label) &&
      result.error
    ) {
      return fallbackToPrimary('replica_error', result.error);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RPC failed';
    if (
      message.startsWith('circuit_open:') &&
      !options.forcePrimary &&
      isReplicaLabel(endpoint.label)
    ) {
      return fallbackToPrimary('circuit_open', message);
    }
    return { data: null, error: message, route: endpoint.label };
  }
}

/** Legacy path — uses default supabase client (primary/pooler). Prefer callSupabaseRpc. */
export async function callSupabaseRpcLegacy<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult<T>> {
  const { supabase } = await import('@/integrations/supabase/client');
  try {
    const { data, error } = await (supabase as any).rpc(fn, args);
    if (error) return { data: null, error: error.message ?? String(error) };
    return { data: data as T, error: null, route: 'primary' };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'RPC failed' };
  }
}
