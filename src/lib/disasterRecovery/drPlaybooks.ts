/**
 * Phase 6 — Disaster recovery operational playbooks.
 */
export type DrPlaybook = {
  id: string;
  title: string;
  scenario: string;
  symptoms: string[];
  likelyCauses: string[];
  immediateActions: string[];
  restoreProcedureId: string;
  verificationSteps: string[];
  escalationPath: string[];
};

export const DR_PLAYBOOKS: DrPlaybook[] = [
  {
    id: 'database-corruption',
    title: 'Database Corruption',
    scenario: 'Data integrity errors, constraint violations, or confirmed corruption',
    symptoms: ['RPC errors on writes', 'Constraint violation spikes', 'Merchant reports wrong data'],
    likelyCauses: ['Failed migration', 'Manual SQL error', 'Hardware/storage fault', 'Partial restore'],
    immediateActions: [
      'Stop destructive writes if safe (maintenance mode for merchants)',
      'Identify corruption scope and timestamp',
      'Snapshot current state before any fix attempt',
    ],
    restoreProcedureId: 'restore-database-full',
    verificationSteps: [
      'PITR to timestamp before corruption',
      'Row count reconciliation on orders/products',
      'platform_health_check ok',
    ],
    escalationPath: ['DBA on-call', 'SRE lead', 'CTO if checkout impacted'],
  },
  {
    id: 'storage-failure',
    title: 'Storage Failure',
    scenario: 'Object storage bucket unavailable or data loss',
    symptoms: ['Image 404/5xx', 'Upload failures', 'CDN origin errors'],
    likelyCauses: ['Bucket policy change', 'Region outage', 'Accidental deletion', 'Quota exceeded'],
    immediateActions: [
      'Identify affected buckets',
      'Fail CDN to replica origin if available',
      'Disable uploads UI message if prolonged',
    ],
    restoreProcedureId: 'restore-storage-buckets',
    verificationSteps: ['20 sample images load', 'Upload test succeeds', 'ETag match on replica'],
    escalationPath: ['Storage/Ops', 'SRE'],
  },
  {
    id: 'infrastructure-outage',
    title: 'Infrastructure Outage',
    scenario: 'Primary Supabase project or hosting unavailable',
    symptoms: ['platform_health_check fail', 'All RPCs timeout', 'health.json down'],
    likelyCauses: ['Provider outage', 'Network partition', 'DDoS', 'Config regression'],
    immediateActions: [
      'Confirm provider status page',
      'checkEndpointHealth on primary and failover',
      'activateFailover() if secondary configured',
    ],
    restoreProcedureId: 'restore-database-full',
    verificationSteps: [
      'Primary or failover endpoint healthy',
      'Checkout smoke test passes',
      'Realtime reconnects',
    ],
    escalationPath: ['SRE immediate', 'Provider support ticket', 'Comms if customer-facing'],
  },
  {
    id: 'deployment-rollback',
    title: 'Deployment Rollback',
    scenario: 'Bad release causing errors or regression',
    symptoms: ['Error rate spike post-deploy', 'New RPC failures', 'UI broken for merchants'],
    likelyCauses: ['Bad migration', 'Env mismatch', 'Edge function regression'],
    immediateActions: [
      'Identify release tag/commit',
      'Rollback frontend deployment',
      'Redeploy edge functions from previous tag if needed',
    ],
    restoreProcedureId: 'restore-application-deploy',
    verificationSteps: ['Error rate normalized', 'Typecheck on rolled-back tag', 'Smoke checkout'],
    escalationPath: ['Release owner', 'SRE'],
  },
  {
    id: 'secret-compromise',
    title: 'Secret Compromise',
    scenario: 'Suspected leak of service role key, API keys, or webhook secrets',
    symptoms: ['Unauthorized API calls', 'Security alert', 'Anomalous admin actions'],
    likelyCauses: ['Committed secret', 'Phishing', 'Compromised CI', 'Log exposure'],
    immediateActions: [
      'Rotate ALL compromised secrets immediately',
      'Revoke active sessions if auth key affected',
      'Audit access logs for exfiltration window',
    ],
    restoreProcedureId: 'restore-secrets-vault',
    verificationSteps: [
      'Old secrets invalidated',
      'Edge functions redeployed',
      'No unauthorized access in audit log',
    ],
    escalationPath: ['Security lead', 'SRE', 'Legal if PII exposure'],
  },
  {
    id: 'regional-outage',
    title: 'Regional Outage',
    scenario: 'Entire cloud region unavailable',
    symptoms: ['Multi-service failure', 'Provider regional status red', 'Global user impact'],
    likelyCauses: ['Regional provider outage', 'Natural disaster', 'Network backbone cut'],
    immediateActions: [
      'Activate DR secondary region project if provisioned',
      'Update DNS/env to secondary endpoints',
      'Communicate status to merchants',
    ],
    restoreProcedureId: 'restore-database-full',
    verificationSteps: [
      'Secondary region serving traffic',
      'Storage replica accessible',
      'RTO target met per incident log',
    ],
    escalationPath: ['DR commander', 'Executive comms', 'Provider TAM'],
  },
  {
    id: 'background-worker-failure',
    title: 'Background Worker Failure',
    scenario: 'Import jobs, webhooks, or async processing stalled',
    symptoms: ['Queue depth spike', 'Dead letter growth', 'Imports stuck pending'],
    likelyCauses: ['Worker crash', 'Poison message', 'Downstream RPC failure', 'Edge function OOM'],
    immediateActions: [
      'get_background_jobs_status() assessment',
      'Quarantine poison job types',
      'Redeploy process-import-jobs',
    ],
    restoreProcedureId: 'restore-background-queues',
    verificationSteps: ['Queue draining', 'No new dead letters 15m', 'Sample job success'],
    escalationPath: ['Background jobs owner', 'SRE'],
  },
];

export function getDrPlaybook(id: string): DrPlaybook | undefined {
  return DR_PLAYBOOKS.find((p) => p.id === id);
}

export function listDrPlaybooks(): Pick<DrPlaybook, 'id' | 'title' | 'scenario'>[] {
  return DR_PLAYBOOKS.map(({ id, title, scenario }) => ({ id, title, scenario }));
}
