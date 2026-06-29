/**
 * In-process metrics registry — counters, histograms, gauges.
 * Vendor-neutral; export via Prometheus / OTEL adapters.
 */
export type MetricType = 'counter' | 'histogram' | 'gauge';

export type MetricLabels = Record<string, string>;

type CounterStore = Map<string, number>;
type GaugeStore = Map<string, number>;
type HistogramStore = Map<string, { count: number; sum: number; buckets: Map<number, number> }>;

const DEFAULT_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const counters: CounterStore = new Map();
const gauges: GaugeStore = new Map();
const histograms: HistogramStore = new Map();

function labelKey(name: string, labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`);
  return `${name}{${parts.join(',')}}`;
}

export function incrementCounter(
  name: string,
  value = 1,
  labels?: MetricLabels
): void {
  const key = labelKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + value);
}

export function setGauge(name: string, value: number, labels?: MetricLabels): void {
  const key = labelKey(name, labels);
  gauges.set(key, value);
}

export function observeHistogram(
  name: string,
  valueMs: number,
  labels?: MetricLabels,
  buckets = DEFAULT_BUCKETS_MS
): void {
  const key = labelKey(name, labels);
  let h = histograms.get(key);
  if (!h) {
    h = { count: 0, sum: 0, buckets: new Map(buckets.map((b) => [b, 0])) };
    histograms.set(key, h);
  }
  h.count += 1;
  h.sum += valueMs;
  for (const b of buckets) {
    if (valueMs <= b) h.buckets.set(b, (h.buckets.get(b) ?? 0) + 1);
  }
}

export type CollectedCounter = { name: string; labels: MetricLabels; value: number };
export type CollectedGauge = { name: string; labels: MetricLabels; value: number };
export type CollectedHistogram = {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  avg: number;
  p50: number;
  p95: number;
  buckets: Record<number, number>;
};

function parseLabelKey(key: string): { name: string; labels: MetricLabels } {
  const brace = key.indexOf('{');
  if (brace < 0) return { name: key, labels: {} };
  const name = key.slice(0, brace);
  const inner = key.slice(brace + 1, -1);
  const labels: MetricLabels = {};
  if (inner) {
    for (const part of inner.split(',')) {
      const eq = part.indexOf('=');
      if (eq > 0) labels[part.slice(0, eq)] = part.slice(eq + 2, -1);
    }
  }
  return { name, labels };
}

export function getCounterSnapshot(): CollectedCounter[] {
  return [...counters.entries()].map(([key, value]) => {
    const { name, labels } = parseLabelKey(key);
    return { name, labels, value };
  });
}

export function getGaugeSnapshot(): CollectedGauge[] {
  return [...gauges.entries()].map(([key, value]) => {
    const { name, labels } = parseLabelKey(key);
    return { name, labels, value };
  });
}

export function getHistogramSnapshot(): CollectedHistogram[] {
  return [...histograms.entries()].map(([key, h]) => {
    const { name, labels } = parseLabelKey(key);
    const avg = h.count > 0 ? h.sum / h.count : 0;
    const bucketEntries = [...h.buckets.entries()].sort((a, b) => a[0] - b[0]);
    const p50Bucket = bucketEntries.find(([, c]) => c >= h.count * 0.5);
    const p95Bucket = bucketEntries.find(([, c]) => c >= h.count * 0.95);
    return {
      name,
      labels,
      count: h.count,
      sum: h.sum,
      avg: Math.round(avg),
      p50: p50Bucket?.[0] ?? 0,
      p95: p95Bucket?.[0] ?? 0,
      buckets: Object.fromEntries(h.buckets),
    };
  });
}

export function resetMetricCollectorForTests(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
}
