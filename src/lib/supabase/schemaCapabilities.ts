/**
 * Runtime probes for optional production schema objects.
 * Cached per session — avoids repeated PostgREST errors when premium RPCs/tables are absent.
 */
import { supabase } from '@/integrations/supabase/client';
import { callReadRpc } from '@/lib/readWrite/readClient';
import { callWriteRpc } from '@/lib/readWrite/writeClient';

const PROBE_OWNER = '00000000-0000-0000-0000-000000000000';

type CapabilityKey =
  | 'inventoryPageBundleRpc'
  | 'merchantInventorySummaryRpc'
  | 'batchRestockRpc'
  | 'inventoryMovementsRpc'
  | 'warehouseTables'
  | 'dashboardKpisLightRpc'
  | 'dashboardWorkflowCountsRpc'
  | 'statisticsPageBundleRpc'
  | 'monitoringAuditRpc'
  | 'webhookWorkerStartRpc';

const cache = new Map<CapabilityKey, boolean>();

function isMissingObjectError(message: string | undefined): boolean {
  const msg = (message ?? '').toLowerCase();
  return (
    msg.includes('could not find the function') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('relation') && msg.includes('does not exist')
  );
}

function isMissingTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  return isMissingObjectError(error.message);
}

async function probeWriteRpcExists(name: string, args: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await callWriteRpc(name, args);
    if (!error) return true;
    return !isMissingObjectError(error);
  } catch {
    return false;
  }
}

async function probeRpcExists(name: string, args: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await callReadRpc(name, args);
    if (!error) return true;
    return !isMissingObjectError(error);
  } catch {
    return false;
  }
}

async function probeTableExists(table: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).select('id').limit(0);
    return !isMissingTableError(error);
  } catch {
    return false;
  }
}

async function resolveCapability(key: CapabilityKey): Promise<boolean> {
  const hit = cache.get(key);
  if (hit != null) return hit;

  let available = false;
  switch (key) {
    case 'inventoryPageBundleRpc':
      available = await probeRpcExists('get_merchant_inventory_page_bundle', {
        p_owner_id: PROBE_OWNER,
        p_limit: 1,
      });
      break;
    case 'merchantInventorySummaryRpc':
      available = await probeRpcExists('merchant_inventory_summary', {
        p_owner_id: PROBE_OWNER,
      });
      break;
    case 'batchRestockRpc':
      available = await probeWriteRpcExists('batch_restock_products', {
        p_owner_id: PROBE_OWNER,
        p_items: [],
      });
      break;
    case 'inventoryMovementsRpc':
      available = await probeRpcExists('list_merchant_inventory_movements', {
        p_owner_id: PROBE_OWNER,
        p_limit: 1,
      });
      break;
    case 'warehouseTables':
      available = await probeTableExists('warehouses');
      break;
    case 'dashboardKpisLightRpc':
      available = await probeRpcExists('get_dashboard_kpis_light', { p_owner_id: PROBE_OWNER });
      break;
    case 'dashboardWorkflowCountsRpc':
      available = await probeRpcExists('get_dashboard_workflow_counts', { p_owner_id: PROBE_OWNER });
      break;
    case 'statisticsPageBundleRpc':
      available = await probeRpcExists('get_statistics_page_bundle', {
        p_owner_id: PROBE_OWNER,
        p_current_start: new Date().toISOString(),
        p_current_end: new Date().toISOString(),
        p_previous_start: new Date().toISOString(),
        p_previous_end: new Date().toISOString(),
      });
      break;
    case 'monitoringAuditRpc':
      available = await probeRpcExists('platform_monitoring_observability_audit', {});
      break;
    case 'webhookWorkerStartRpc':
      available = await probeRpcExists('process_webhook_outbox_worker_start', { p_limit: 1 });
      break;
  }

  cache.set(key, available);
  return available;
}

export async function hasInventoryPageBundleRpc(): Promise<boolean> {
  return resolveCapability('inventoryPageBundleRpc');
}

export async function hasMerchantInventorySummaryRpc(): Promise<boolean> {
  return resolveCapability('merchantInventorySummaryRpc');
}

export async function hasBatchRestockRpc(): Promise<boolean> {
  return resolveCapability('batchRestockRpc');
}

export async function hasInventoryMovementsRpc(): Promise<boolean> {
  return resolveCapability('inventoryMovementsRpc');
}

export async function hasWarehouseInventory(): Promise<boolean> {
  return resolveCapability('warehouseTables');
}

export async function hasDashboardKpisLightRpc(): Promise<boolean> {
  return resolveCapability('dashboardKpisLightRpc');
}

export async function hasDashboardWorkflowCountsRpc(): Promise<boolean> {
  return resolveCapability('dashboardWorkflowCountsRpc');
}

export async function hasStatisticsPageBundleRpc(): Promise<boolean> {
  return resolveCapability('statisticsPageBundleRpc');
}

export async function hasMonitoringAuditRpc(): Promise<boolean> {
  return resolveCapability('monitoringAuditRpc');
}

export async function hasWebhookWorkerStartRpc(): Promise<boolean> {
  return resolveCapability('webhookWorkerStartRpc');
}

/** Test helper — reset cached probes. */
export function resetSchemaCapabilityCacheForTests(): void {
  cache.clear();
}
