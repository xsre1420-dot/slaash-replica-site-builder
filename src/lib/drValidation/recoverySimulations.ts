/**
 * Phase 2 — Recovery simulation scenarios and validation procedures.
 */
export type RecoverySimulationScenario =
  | 'database_restore'
  | 'storage_restore'
  | 'application_redeploy'
  | 'configuration_recovery'
  | 'environment_recovery'
  | 'background_worker_restart'
  | 'queue_recovery'
  | 'cache_rebuild';

export type RecoverySimulation = {
  id: RecoverySimulationScenario;
  title: string;
  linkedProcedureId: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  estimatedDurationMin: number;
  automated: boolean;
  script?: string;
  preconditions: string[];
  simulationSteps: string[];
  successCriteria: string[];
};

export const RECOVERY_SIMULATIONS: RecoverySimulation[] = [
  {
    id: 'database_restore',
    title: 'Database Restore Simulation',
    linkedProcedureId: 'restore-database-full',
    frequency: 'quarterly',
    estimatedDurationMin: 90,
    automated: true,
    script: 'scripts/run-recovery-simulation.mjs',
    preconditions: ['Staging project available', 'Latest backup file or PITR window'],
    simulationSteps: [
      'Restore backup to staging (not production)',
      'Run platform_health_check() on staging',
      'Execute integrity-check.mjs against staging URL',
      'Compare orders/products row counts with baseline snapshot',
    ],
    successCriteria: [
      'platform_health_check ok',
      'All integrity checks pass',
      'Row count delta < 1%',
    ],
  },
  {
    id: 'storage_restore',
    title: 'Storage Restore Simulation',
    linkedProcedureId: 'restore-storage-buckets',
    frequency: 'quarterly',
    estimatedDurationMin: 120,
    automated: false,
    preconditions: ['Replica bucket or backup export access'],
    simulationSteps: [
      'Select 10 random objects per bucket',
      'Restore to staging bucket prefix',
      'Verify ETag/checksum match',
      'Load storefront sample URLs',
    ],
    successCriteria: ['All sample objects accessible', 'MIME types preserved'],
  },
  {
    id: 'application_redeploy',
    title: 'Application Redeployment Simulation',
    linkedProcedureId: 'restore-application-deploy',
    frequency: 'monthly',
    estimatedDurationMin: 30,
    automated: true,
    script: 'scripts/run-recovery-simulation.mjs',
    preconditions: ['Previous release tag identified'],
    simulationSteps: [
      'Deploy previous git tag to staging',
      'Run recovery:check against staging URL',
      'Verify initMonitoring and DR modules load',
    ],
    successCriteria: ['health.json ok', 'recovery:check passes', 'No console errors on load'],
  },
  {
    id: 'configuration_recovery',
    title: 'Configuration Recovery Simulation',
    linkedProcedureId: 'restore-configuration-git',
    frequency: 'monthly',
    estimatedDurationMin: 20,
    automated: true,
    script: 'scripts/run-recovery-simulation.mjs',
    preconditions: ['Git access to release tags'],
    simulationSteps: [
      'Verify gitBackedPaths exist at tag',
      'Compare .env.example keys with SECRETS_INVENTORY',
      'Run typecheck on tag checkout',
    ],
    successCriteria: ['All config paths present', 'No missing env keys documented'],
  },
  {
    id: 'environment_recovery',
    title: 'Environment Recovery Simulation',
    linkedProcedureId: 'restore-environment',
    frequency: 'quarterly',
    estimatedDurationMin: 25,
    automated: true,
    script: 'scripts/run-recovery-simulation.mjs',
    preconditions: ['CI env artifact or deployment manifest'],
    simulationSteps: [
      'Diff staging env keys against .env.example inventory',
      'Verify VITE_FAILOVER_SUPABASE_URL documented if DR enabled',
      'Confirm resolveSupabaseConfig resolves primary',
    ],
    successCriteria: ['No undocumented required keys', 'Failover URL documented when configured'],
  },
  {
    id: 'background_worker_restart',
    title: 'Background Worker Restart Simulation',
    linkedProcedureId: 'restore-background-queues',
    frequency: 'monthly',
    estimatedDurationMin: 45,
    automated: true,
    script: 'scripts/run-recovery-simulation.mjs',
    preconditions: ['get_background_jobs_status RPC available'],
    simulationSteps: [
      'Record baseline queue depth',
      'Simulate worker restart (redeploy process-import-jobs on staging)',
      'Verify queue drains without new dead letters',
    ],
    successCriteria: ['Queue depth stable or decreasing', 'Dead letter rate zero for 15m'],
  },
  {
    id: 'queue_recovery',
    title: 'Queue Recovery Simulation',
    linkedProcedureId: 'restore-background-queues',
    frequency: 'quarterly',
    estimatedDurationMin: 60,
    automated: false,
    preconditions: ['Test import_jobs rows in staging'],
    simulationSteps: [
      'Insert test job; verify processing',
      'Simulate stuck job reset SQL',
      'Replay from dead letter after fix',
    ],
    successCriteria: ['Test job completes', 'No duplicate processing'],
  },
  {
    id: 'cache_rebuild',
    title: 'Cache Rebuild Simulation',
    linkedProcedureId: 'failoverReadiness cache warm',
    frequency: 'monthly',
    estimatedDurationMin: 30,
    automated: true,
    script: 'scripts/run-recovery-simulation.mjs',
    preconditions: ['Cache monitoring module active'],
    simulationSteps: [
      'Clear in-memory cache layer (staging)',
      'Trigger storefront bundle load',
      'Verify cache hit rate recovers',
      'Confirm origin DB load acceptable',
    ],
    successCriteria: ['cache_hit_rate > 50% within 10m', 'No cache circuit open'],
  },
];

export function getRecoverySimulation(id: RecoverySimulationScenario): RecoverySimulation | undefined {
  return RECOVERY_SIMULATIONS.find((s) => s.id === id);
}

export function listRecoverySimulations(): Pick<RecoverySimulation, 'id' | 'title' | 'frequency' | 'automated'>[] {
  return RECOVERY_SIMULATIONS.map(({ id, title, frequency, automated }) => ({
    id,
    title,
    frequency,
    automated,
  }));
}
