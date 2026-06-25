/**
 * Customer metrics — merchant-scoped reads aligned with analytics RPC semantics.
 */
import { supabase } from '@/integrations/supabase/client';

export interface CustomerPeriodMetrics {
  new_customers: number;
  returning_customers: number;
}

/** Match get_store_statistics customer semantics when RPC KPIs are missing. */
export async function fetchCustomerMetricsForPeriod(
  ownerId: string,
  periodStart: string,
  periodEnd: string
): Promise<CustomerPeriodMetrics> {
  const [newResult, returningResult] = await Promise.all([
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('first_order_date', periodStart)
      .lte('first_order_date', periodEnd),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .lt('first_order_date', periodStart)
      .gte('last_order_date', periodStart)
      .lte('last_order_date', periodEnd),
  ]);

  if (newResult.error && returningResult.error) {
    return { new_customers: 0, returning_customers: 0 };
  }

  return {
    new_customers: newResult.count ?? 0,
    returning_customers: returningResult.count ?? 0,
  };
}
