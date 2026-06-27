export { DR_TARGETS, DR_STORAGE_KEYS, DR_THRESHOLDS, type RecoveryMode } from './config';
export {
  isFailoverActive,
  activateFailover,
  deactivateFailover,
  resolveSupabaseConfig,
  checkEndpointHealth,
  getRecoveryEndpoints,
} from './failover';
export {
  classifyRpcRoute,
  getReadRoutingSummary,
  hasReadReplica,
  isStorefrontEdgeEnabled,
  resolveRpcEndpoint,
  READ_REPLICA_RPCS,
  EDGE_CACHED_OPERATIONS,
} from './readRouting';
export type { RpcEndpoint, RpcRouteTarget } from './readRouting';
export { getSupabaseClient, resetSupabaseClient } from './supabaseClient';
export {
  exportLocalBackup,
  downloadLocalBackup,
  restoreLocalBackup,
  importLocalBackupFromFile,
  type LocalBackupSnapshot,
} from './localBackup';
