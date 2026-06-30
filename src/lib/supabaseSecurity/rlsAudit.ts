/**
 * Phase 1 — RLS audit registry and coverage catalogue.
 */
export type RlsPolicyStatus = 'secured' | 'hardened' | 'deny_all' | 'security_definer_rpc';

export type RlsTableEntry = {
  table: string;
  rlsEnabled: boolean;
  policyModel: RlsPolicyStatus;
  notes: string;
  hardenedV92?: boolean;
};

export const RLS_TABLE_REGISTRY: RlsTableEntry[] = [
  { table: 'products', rlsEnabled: true, policyModel: 'secured', notes: 'tenant_row_owned(owner_id, store_id)' },
  { table: 'orders', rlsEnabled: true, policyModel: 'secured', notes: 'tenant_row_owned + restricted insert' },
  { table: 'order_items', rlsEnabled: true, policyModel: 'secured', notes: 'via orders join tenant_row_owned' },
  { table: 'customers', rlsEnabled: true, policyModel: 'secured', notes: 'owner_id scoped' },
  { table: 'store_settings', rlsEnabled: true, policyModel: 'hardened', notes: 'owner_id; WITH CHECK on UPDATE v92', hardenedV92: true },
  { table: 'profiles', rlsEnabled: true, policyModel: 'hardened', notes: 'auth.uid match; WITH CHECK on UPDATE v92', hardenedV92: true },
  { table: 'marketing_settings', rlsEnabled: true, policyModel: 'hardened', notes: 'WITH CHECK prevents owner_id escalation v39' },
  { table: 'marketing_coupons', rlsEnabled: true, policyModel: 'hardened', notes: 'WITH CHECK prevents owner_id escalation v39' },
  { table: 'merchant_access_codes', rlsEnabled: true, policyModel: 'deny_all', notes: 'edge service_role only' },
  { table: 'platform_admins', rlsEnabled: true, policyModel: 'secured', notes: 'is_platform_admin()' },
  { table: 'leads', rlsEnabled: true, policyModel: 'secured', notes: 'admin only' },
  { table: 'subscriptions', rlsEnabled: true, policyModel: 'secured', notes: 'owner scoped' },
  { table: 'import_jobs', rlsEnabled: true, policyModel: 'secured', notes: 'import_jobs_owner_all' },
  { table: 'order_webhook_outbox', rlsEnabled: true, policyModel: 'secured', notes: 'owner select only' },
  { table: 'rpc_rate_limits', rlsEnabled: true, policyModel: 'deny_all', notes: 'FOR ALL USING (false)' },
  { table: 'platform_schema_version', rlsEnabled: true, policyModel: 'deny_all', notes: 'platform_schema_version_deny' },
  { table: 'store_visits', rlsEnabled: true, policyModel: 'secured', notes: 'owner view + deny public SELECT' },
  { table: 'inventory_movements', rlsEnabled: true, policyModel: 'secured', notes: 'owner view' },
  { table: 'analytics_event_outbox', rlsEnabled: true, policyModel: 'secured', notes: 'owner view' },
  { table: 'storage.objects', rlsEnabled: true, policyModel: 'secured', notes: 'product-images folder owner match' },
];

export type RlsAuditFinding = {
  id: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'fixed' | 'mitigated' | 'accepted';
  fix: string;
};

export const RLS_AUDIT_FINDINGS: RlsAuditFinding[] = [
  { id: 'rls.missing', issue: 'Tables without RLS', severity: 'critical', status: 'fixed', fix: 'All tenant tables ENABLE ROW LEVEL SECURITY' },
  { id: 'rls.permissive_public', issue: 'Public SELECT on tenant data', severity: 'high', status: 'fixed', fix: 'Storefront via SECURITY DEFINER RPCs only' },
  { id: 'rls.duplicate', issue: 'Duplicate legacy restaurant policies', severity: 'medium', status: 'mitigated', fix: 'Superseded by tenant_row_owned v5+' },
  { id: 'rls.escalation', issue: 'UPDATE without WITH CHECK on owner_id', severity: 'high', status: 'fixed', fix: 'v39 marketing + v92 profiles/store_settings' },
  { id: 'rls.internal', issue: 'Internal tables client-accessible', severity: 'high', status: 'fixed', fix: 'rpc_rate_limits deny_all' },
  { id: 'rls.inefficient', issue: 'Per-row auth without index', severity: 'low', status: 'accepted', fix: 'owner_id indexed on hot tables' },
];

export function getRlsAuditSummary(): {
  tables: number;
  rlsEnabled: number;
  hardened: number;
  denyAll: number;
  findingsFixed: number;
  coveragePct: number;
} {
  const rlsEnabled = RLS_TABLE_REGISTRY.filter((t) => t.rlsEnabled).length;
  const hardened = RLS_TABLE_REGISTRY.filter((t) => t.policyModel === 'hardened').length;
  const denyAll = RLS_TABLE_REGISTRY.filter((t) => t.policyModel === 'deny_all').length;
  const findingsFixed = RLS_AUDIT_FINDINGS.filter((f) => f.status === 'fixed' || f.status === 'mitigated').length;
  return {
    tables: RLS_TABLE_REGISTRY.length,
    rlsEnabled,
    hardened,
    denyAll,
    findingsFixed,
    coveragePct: Math.round((rlsEnabled / RLS_TABLE_REGISTRY.length) * 100),
  };
}
