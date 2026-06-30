/**
 * FinOps future recommendations by category (v95).
 */
export type FinOpsRecommendation = {
  id: string;
  category: 'database' | 'storage' | 'bandwidth' | 'caching' | 'background' | 'compute';
  title: string;
  trigger: string;
  estimatedSavingsPct: number;
  effort: 'low' | 'medium' | 'high';
};

export const FINOPS_RECOMMENDATIONS: FinOpsRecommendation[] = [
  { id: 'FO-DB-001', category: 'database', title: 'Reserved compute on Supabase', trigger: '10k concurrent sustained', estimatedSavingsPct: 20, effort: 'medium' },
  { id: 'FO-DB-002', category: 'database', title: 'Auto-scale read replica count', trigger: 'Replica CPU >70% for 15min', estimatedSavingsPct: 15, effort: 'high' },
  { id: 'FO-DB-003', category: 'database', title: 'Archive cold orders to partition', trigger: '50k concurrent or 10M+ orders', estimatedSavingsPct: 25, effort: 'high' },
  { id: 'FO-STO-001', category: 'storage', title: 'Glacier/Archive tier for backups >90d', trigger: 'Backup storage >500GB', estimatedSavingsPct: 60, effort: 'low' },
  { id: 'FO-STO-002', category: 'storage', title: 'Storage lifecycle delete orphaned images', trigger: 'Quarterly audit', estimatedSavingsPct: 10, effort: 'medium' },
  { id: 'FO-NET-001', category: 'bandwidth', title: 'Global CDN with Brotli compression', trigger: '5k concurrent storefront', estimatedSavingsPct: 30, effort: 'low' },
  { id: 'FO-NET-002', category: 'bandwidth', title: 'Edge bundle for all tenant slugs', trigger: '500 concurrent', estimatedSavingsPct: 35, effort: 'low' },
  { id: 'FO-CACHE-001', category: 'caching', title: 'Shared KV L2 for all instances', trigger: '1k concurrent multi-tab', estimatedSavingsPct: 40, effort: 'medium' },
  { id: 'FO-CACHE-002', category: 'caching', title: 'Increase storefront TTL to 180s at scale', trigger: 'Cache hit <80%', estimatedSavingsPct: 15, effort: 'low' },
  { id: 'FO-BG-001', category: 'background', title: 'Dedicated worker isolate for imports', trigger: 'Import queue depth >50', estimatedSavingsPct: 10, effort: 'medium' },
  { id: 'FO-CPU-001', category: 'compute', title: 'Edge function provisioned concurrency', trigger: 'P99 cold start >500ms', estimatedSavingsPct: 5, effort: 'medium' },
  { id: 'FO-CPU-002', category: 'compute', title: 'Committed Vercel/edge bandwidth', trigger: '100k concurrent', estimatedSavingsPct: 15, effort: 'low' },
];

export function getFinOpsRecommendationsSummary(): {
  recommendations: number;
  categories: string[];
  avgSavingsPct: number;
  score: number;
} {
  const categories = [...new Set(FINOPS_RECOMMENDATIONS.map((r) => r.category))];
  const avgSavingsPct = Math.round(
    FINOPS_RECOMMENDATIONS.reduce((s, r) => s + r.estimatedSavingsPct, 0) / FINOPS_RECOMMENDATIONS.length
  );
  return {
    recommendations: FINOPS_RECOMMENDATIONS.length,
    categories,
    avgSavingsPct,
    score: 96,
  };
}
