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
export {
  getEnterpriseBackupStatus,
  initBackup,
  getBackupAuditSummary,
  getDatabaseBackupManifest,
  getStorageBackupManifest,
  getConfigurationBackupManifest,
  runStaticBackupValidation,
  getBackupScheduleSummary,
  getPlatformRecoveryTargets,
  type EnterpriseBackupStatus,
} from '@/lib/backup';
export { DR_AUDIT_REGISTRY, getDrAuditSummary } from './drAudit';
export {
  CRITICAL_BUSINESS_SERVICES,
  SERVICE_DEPENDENCY_MAP,
  RECOVERY_PRIORITY_ORDER,
  getEnterpriseRecoveryTargets,
  type CriticalService,
  type EnterpriseRecoveryTargets,
} from './drRecoveryObjectives';
export {
  RESTORE_PROCEDURES,
  getRestoreProcedure,
  getRestoreProcedureById,
  listRestoreProcedures,
  type RestoreProcedure,
} from './restoreProcedures';
export {
  RESTORE_VALIDATION_CHECKS,
  runStaticRestoreValidation,
  getRestoreValidationSummary,
  resetRestoreValidationForTests,
  type RestoreValidationResult,
} from './restoreValidation';
export {
  FAILOVER_CAPABILITIES,
  SERVICE_RECOVERY_SEQUENCE,
  READ_REPLICA_PROMOTION_STEPS,
  getFailoverReadinessSnapshot,
  type FailoverCapability,
  type ServiceRecoveryStep,
} from './failoverReadiness';
export {
  DR_PLAYBOOKS,
  getDrPlaybook,
  listDrPlaybooks,
  type DrPlaybook,
} from './drPlaybooks';
export {
  getEnterpriseDisasterRecoveryStatus,
  initDisasterRecovery,
  resetDisasterRecoveryForTests,
  type EnterpriseDisasterRecoveryStatus,
} from './drEngine';
