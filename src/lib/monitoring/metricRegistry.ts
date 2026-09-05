/**
 * Canonical metric names — vendor-neutral, Prometheus/OTEL compatible.
 */
export const METRIC_NAMES = {
  http: {
    requestsTotal: 'http_requests_total',
    requestDurationMs: 'http_request_duration_ms',
    errorsTotal: 'http_errors_total',
    timeoutsTotal: 'http_timeouts_total',
  },
  rpc: {
    callsTotal: 'rpc_calls_total',
    durationMs: 'rpc_duration_ms',
    errorsTotal: 'rpc_errors_total',
    timeoutsTotal: 'rpc_timeouts_total',
    replicaFallbackTotal: 'rpc_replica_fallback_total',
  },
  edge: {
    invocationsTotal: 'edge_invocations_total',
    durationMs: 'edge_duration_ms',
    errorsTotal: 'edge_errors_total',
  },
  worker: {
    jobsTotal: 'background_jobs_total',
    durationMs: 'background_job_duration_ms',
    deadLetterTotal: 'background_dead_letter_total',
    queueDepth: 'background_queue_depth',
    workerUtilization: 'background_worker_utilization',
  },
  checkout: {
    startedTotal: 'checkout_started_total',
    successTotal: 'checkout_success_total',
    failedTotal: 'checkout_failed_total',
    durationMs: 'checkout_duration_ms',
    successRate: 'checkout_success_rate',
  },
  storefront: {
    pageViewsTotal: 'storefront_page_views_total',
    bundleLoadMs: 'storefront_bundle_load_ms',
    cacheHitRate: 'storefront_cache_hit_rate',
  },
  dashboard: {
    loadMs: 'dashboard_load_ms',
    statsFetchMs: 'dashboard_stats_fetch_ms',
  },
  search: {
    queriesTotal: 'search_queries_total',
    durationMs: 'search_duration_ms',
  },
  product: {
    apiCallsTotal: 'product_api_calls_total',
    createdTotal: 'products_created_total',
    durationMs: 'product_api_duration_ms',
  },
  inventory: {
    updatesTotal: 'inventory_updates_total',
    durationMs: 'inventory_update_duration_ms',
  },
  statistics: {
    fetchMs: 'statistics_fetch_ms',
    queriesTotal: 'statistics_queries_total',
  },
  database: {
    queryDurationMs: 'db_query_duration_ms',
    slowQueriesTotal: 'db_slow_queries_total',
    connectionPoolUtilization: 'db_connection_pool_utilization',
    lockWaitMs: 'db_lock_wait_ms',
    transactionsTotal: 'db_transactions_total',
    cacheHitRatio: 'db_cache_hit_ratio',
    latencyMs: 'db_latency_ms',
  },
  cache: {
    hitsTotal: 'cache_hits_total',
    missesTotal: 'cache_misses_total',
    hitRate: 'cache_hit_rate',
    invalidationsTotal: 'cache_invalidations_total',
    failuresTotal: 'cache_failures_total',
    staleResponsesTotal: 'cache_stale_responses_total',
    originRequestsTotal: 'cache_origin_requests_total',
  },
  analytics: {
    queueDepth: 'analytics_queue_depth',
    processingRate: 'analytics_processing_rate',
    failedJobsTotal: 'analytics_failed_jobs_total',
    backlogAgeMs: 'analytics_backlog_age_ms',
    outboxSpillTotal: 'analytics_outbox_spill_total',
  },
  sideEffects: {
    pending: 'order_side_effects_pending',
    workerStaleMinutes: 'side_effects_worker_stale_minutes',
    deadLetter: 'order_side_effects_dead_letter',
    processedRate: 'order_side_effects_processed_rate',
  },
  orders: {
    createdTotal: 'orders_created_total',
    failedTotal: 'orders_failed_total',
    duplicateAttemptsTotal: 'orders_duplicate_attempts_total',
    stockFailuresTotal: 'orders_stock_failures_total',
    transactionFailuresTotal: 'orders_transaction_failures_total',
    durationMs: 'order_creation_duration_ms',
  },
  security: {
    authFailuresTotal: 'security_auth_failures_total',
    rateLimitViolationsTotal: 'security_rate_limit_violations_total',
    crossTenantAttemptsTotal: 'security_cross_tenant_attempts_total',
    webhookFailuresTotal: 'security_webhook_failures_total',
  },
  infra: {
    cpuUtilization: 'infra_cpu_utilization',
    memoryUtilization: 'infra_memory_utilization',
    storageUtilization: 'infra_storage_utilization',
    bandwidthBytes: 'infra_bandwidth_bytes',
    replicaUtilization: 'read_replica_utilization',
  },
  business: {
    ordersCreatedTotal: 'orders_created_total',
    storeVisitsTotal: 'store_visits_total',
    registrationsTotal: 'customer_registrations_total',
    jobThroughput: 'background_job_throughput',
  },
  /** Server-side DB gauges — synced from platform_monitoring_observability_audit RPC */
  server: {
    dbCpuUtilization: 'server_db_cpu_utilization',
    dbConnectionWait: 'server_db_connection_wait',
    dbLockWaits: 'server_db_lock_waits',
    dbSizeBytes: 'server_db_size_bytes',
  },
  errors: {
    total: 'errors_total',
    byCategory: 'errors_by_category_total',
  },
} as const;

export type MetricDomain = keyof typeof METRIC_NAMES;
