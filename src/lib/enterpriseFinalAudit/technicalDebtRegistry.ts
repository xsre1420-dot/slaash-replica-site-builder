/**
 * Technical debt and low-priority items — final audit (v96).
 */
export type TechnicalDebtItem = {
  id: string;
  priority: 'low' | 'medium';
  area: string;
  description: string;
  recommendation: string;
  blocksProduction: false;
};

export const TECHNICAL_DEBT_REGISTRY: TechnicalDebtItem[] = [
  { id: 'TD-L01', priority: 'low', area: 'connection_pool', description: 'Pooler URL not mandatory in dev', recommendation: 'Enable VITE_SUPABASE_POOLER_URL at 500 concurrent', blocksProduction: false },
  { id: 'TD-L02', priority: 'low', area: 'edge', description: 'Storefront edge optional via env flag', recommendation: 'Enable VITE_STOREFRONT_EDGE_ENABLED in production', blocksProduction: false },
  { id: 'TD-L03', priority: 'low', area: 'types', description: 'Generated types may drift from migrations', recommendation: 'Run db:types after db:deploy in CI', blocksProduction: false },
  { id: 'TD-L04', priority: 'low', area: 'security', description: 'External formal pentest not yet run', recommendation: 'Schedule before regulated-industry customers', blocksProduction: false },
  { id: 'TD-L05', priority: 'low', area: 'dependencies', description: 'esbuild/vite dev-only CVE', recommendation: 'Upgrade Vite major when compatible', blocksProduction: false },
  { id: 'TD-L06', priority: 'medium', area: 'scaling', description: 'KV L2 optional', recommendation: 'Enable Upstash at 1k concurrent multi-instance', blocksProduction: false },
];

export const PRODUCTION_LAUNCH_CHECKLIST = [
  { id: 'PL-01', item: 'Apply all migrations through v96', category: 'database' },
  { id: 'PL-02', item: 'Set VITE_APP_ENV=production', category: 'config' },
  { id: 'PL-03', item: 'Configure ALLOWED_ORIGINS on edge functions', category: 'security' },
  { id: 'PL-04', item: 'Enable Supabase connection pooler URL', category: 'database' },
  { id: 'PL-05', item: 'Configure read replica URL (if >1k concurrent expected)', category: 'scaling' },
  { id: 'PL-06', item: 'Enable CDN base URL for product images', category: 'storage' },
  { id: 'PL-07', item: 'Verify platform_health_check() returns ok', category: 'monitoring' },
  { id: 'PL-08', item: 'Run npm run audit:enterprise-final', category: 'certification' },
  { id: 'PL-09', item: 'Run backup:verify and recovery:simulate', category: 'dr' },
  { id: 'PL-10', item: 'Deploy edge functions (payment-webhook, get-store-products)', category: 'edge' },
  { id: 'PL-11', item: 'Configure observability webhook (optional)', category: 'monitoring' },
  { id: 'PL-12', item: 'Load test at expected peak concurrent users', category: 'performance' },
] as const;

export const RECOMMENDED_ROADMAP = [
  { quarter: 'Launch', milestone: 'Production deploy with v96 schema; enable pooler + CDN' },
  { quarter: 'Q+1', milestone: '500 concurrent: edge storefront + WAF rate rules' },
  { quarter: 'Q+2', milestone: '1k concurrent: read replica + KV L2' },
  { quarter: 'Q+3', milestone: '5k concurrent: reserved compute + quarterly FinOps review' },
  { quarter: 'Q+4', milestone: '10k+ concurrent: auto-scale replicas; external pentest' },
];

export function getTechnicalDebtSummary(): {
  items: number;
  low: number;
  medium: number;
  blocksProduction: number;
} {
  return {
    items: TECHNICAL_DEBT_REGISTRY.length,
    low: TECHNICAL_DEBT_REGISTRY.filter((t) => t.priority === 'low').length,
    medium: TECHNICAL_DEBT_REGISTRY.filter((t) => t.priority === 'medium').length,
    blocksProduction: 0,
  };
}
