import { supabase } from '@/integrations/supabase/client';
import { resolveRpcEndpoint } from '@/lib/disasterRecovery/readRouting';
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
};

/** Typed RPC wrapper with read-replica routing + circuit breaker. */
export async function callSupabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options: RpcCallOptions = {}
): Promise<RpcResult<T>> {
  const endpoint = resolveRpcEndpoint(fn, options.forcePrimary);
  const breakerName = `rpc:${fn}:${endpoint.label}`;

  const execute = async (): Promise<RpcResult<T>> => {
    const controller = new AbortController();
    const timeout = options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

    try {
      const res = await fetch(`${endpoint.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: endpoint.key,
          Authorization: `Bearer ${endpoint.key}`,
          'Content-Type': 'application/json',
          ...(endpoint.headers ?? {}),
        },
        body: JSON.stringify(args),
      });

      const text = await res.text();
      let data: T | null = null;
      try {
        data = text ? (JSON.parse(text) as T) : null;
      } catch {
        return { data: null, error: text.slice(0, 200) || 'Invalid RPC response', route: endpoint.label };
      }

      if (!res.ok) {
        const errMsg =
          typeof data === 'object' && data && 'message' in (data as object)
            ? String((data as { message?: string }).message)
            : text.slice(0, 200) || `RPC ${fn} failed (${res.status})`;
        return { data: null, error: errMsg, route: endpoint.label };
      }

      return { data, error: null, route: endpoint.label };
    } catch (err) {
      if (options.skipBreaker) throw err;
      const message = err instanceof Error ? err.message : 'RPC failed';
      return { data: null, error: message, route: endpoint.label };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  try {
    if (options.skipBreaker) {
      return await execute();
    }
    return await withCircuitBreaker(breakerName, execute, {
      failureThreshold: 4,
      openMs: 12_000,
      name: breakerName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RPC failed';
    if (message.startsWith('circuit_open:') && !options.forcePrimary && endpoint.label === 'read_replica') {
      return callSupabaseRpc<T>(fn, args, { ...options, forcePrimary: true, skipBreaker: true });
    }
    return { data: null, error: message, route: endpoint.label };
  }
}

/** Legacy path — uses default supabase client (primary/pooler). Prefer callSupabaseRpc. */
export async function callSupabaseRpcLegacy<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult<T>> {
  try {
    const { data, error } = await (supabase as any).rpc(fn, args);
    if (error) return { data: null, error: error.message ?? String(error) };
    return { data: data as T, error: null, route: 'primary' };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'RPC failed' };
  }
}
