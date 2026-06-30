/**
 * Phase 2 — Enterprise recovery objectives (RTO/RPO, priorities, dependency map).
 */
import { DR_TARGETS } from './config';

export type CriticalService = {
  id: string;
  name: string;
  priority: 1 | 2 | 3;
  rpoMinutes: number;
  rtoMinutes: number;
  dependsOn: string[];
};

export const CRITICAL_BUSINESS_SERVICES: CriticalService[] = [
  {
    id: 'checkout',
    name: 'Checkout & Order Creation',
    priority: 1,
    rpoMinutes: 1,
    rtoMinutes: 15,
    dependsOn: ['database', 'rpc_layer', 'inventory', 'payment_webhook'],
  },
  {
    id: 'storefront',
    name: 'Customer Storefront',
    priority: 1,
    rpoMinutes: 15,
    rtoMinutes: 30,
    dependsOn: ['database', 'edge_functions', 'storage', 'cache'],
  },
  {
    id: 'merchant_dashboard',
    name: 'Merchant Dashboard',
    priority: 2,
    rpoMinutes: 15,
    rtoMinutes: 45,
    dependsOn: ['database', 'rpc_layer', 'realtime', 'auth'],
  },
  {
    id: 'inventory',
    name: 'Inventory Synchronization',
    priority: 1,
    rpoMinutes: 5,
    rtoMinutes: 30,
    dependsOn: ['database', 'rpc_layer', 'realtime'],
  },
  {
    id: 'background_jobs',
    name: 'Background Processing',
    priority: 2,
    rpoMinutes: 15,
    rtoMinutes: 60,
    dependsOn: ['database', 'edge_functions', 'webhook_outbox'],
  },
  {
    id: 'auth',
    name: 'Authentication & Authorization',
    priority: 1,
    rpoMinutes: 0,
    rtoMinutes: 20,
    dependsOn: ['database', 'secrets'],
  },
  {
    id: 'storage',
    name: 'Media & Asset Storage',
    priority: 2,
    rpoMinutes: 1440,
    rtoMinutes: 120,
    dependsOn: ['object_storage', 'cdn'],
  },
  {
    id: 'analytics',
    name: 'Analytics & Reporting',
    priority: 3,
    rpoMinutes: 60,
    rtoMinutes: 120,
    dependsOn: ['database', 'read_replica'],
  },
];

export type ServiceDependencyNode = {
  id: string;
  label: string;
  tier: 'core' | 'data' | 'edge' | 'support';
  upstream: string[];
};

/** Service dependency map for recovery sequencing. */
export const SERVICE_DEPENDENCY_MAP: ServiceDependencyNode[] = [
  { id: 'secrets', label: 'Secrets / Vault', tier: 'core', upstream: [] },
  { id: 'database', label: 'PostgreSQL Primary', tier: 'data', upstream: ['secrets'] },
  { id: 'read_replica', label: 'Read Replica', tier: 'data', upstream: ['database'] },
  { id: 'object_storage', label: 'Object Storage', tier: 'data', upstream: [] },
  { id: 'rpc_layer', label: 'RPC / PostgREST', tier: 'core', upstream: ['database', 'secrets'] },
  { id: 'edge_functions', label: 'Edge Functions', tier: 'edge', upstream: ['rpc_layer', 'secrets'] },
  { id: 'cache', label: 'Enterprise Cache', tier: 'support', upstream: ['database'] },
  { id: 'realtime', label: 'Realtime', tier: 'support', upstream: ['database'] },
  { id: 'auth', label: 'Supabase Auth', tier: 'core', upstream: ['database', 'secrets'] },
  { id: 'checkout', label: 'Checkout Service', tier: 'core', upstream: ['rpc_layer', 'inventory', 'auth'] },
  { id: 'inventory', label: 'Inventory', tier: 'core', upstream: ['rpc_layer', 'realtime'] },
  { id: 'background_workers', label: 'Job Workers', tier: 'support', upstream: ['database', 'edge_functions'] },
  { id: 'application', label: 'Frontend Deployment', tier: 'edge', upstream: ['rpc_layer', 'edge_functions', 'auth'] },
];

export const RECOVERY_PRIORITY_ORDER = [
  'secrets',
  'database',
  'rpc_layer',
  'auth',
  'object_storage',
  'edge_functions',
  'cache',
  'realtime',
  'inventory',
  'checkout',
  'storefront',
  'background_workers',
  'application',
  'analytics',
] as const;

export type EnterpriseRecoveryTargets = {
  globalRpoMinutes: number;
  globalRtoMinutes: number;
  tier1RpoMinutes: number;
  tier1RtoMinutes: number;
  criticalServices: CriticalService[];
  dependencyMap: ServiceDependencyNode[];
  recoverySequence: readonly string[];
};

export function getEnterpriseRecoveryTargets(): EnterpriseRecoveryTargets {
  return {
    globalRpoMinutes: DR_TARGETS.RPO_MINUTES,
    globalRtoMinutes: DR_TARGETS.RTO_MINUTES,
    tier1RpoMinutes: 1,
    tier1RtoMinutes: 15,
    criticalServices: CRITICAL_BUSINESS_SERVICES,
    dependencyMap: SERVICE_DEPENDENCY_MAP,
    recoverySequence: RECOVERY_PRIORITY_ORDER,
  };
}
