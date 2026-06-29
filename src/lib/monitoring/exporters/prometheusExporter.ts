/**
 * Prometheus text exposition format — scrape-ready without vendor lock-in.
 */
import type { CollectedCounter, CollectedGauge, CollectedHistogram } from '../metricCollector';

function formatLabels(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  return `{${keys.map((k) => `${k}="${labels[k]}"`).join(',')}}`;
}

export function formatPrometheusMetrics(input: {
  counters: CollectedCounter[];
  gauges: CollectedGauge[];
  histograms: CollectedHistogram[];
}): string {
  const lines: string[] = [];

  const counterNames = new Set(input.counters.map((c) => c.name));
  for (const name of counterNames) {
    lines.push(`# TYPE ${name} counter`);
    for (const c of input.counters.filter((x) => x.name === name)) {
      lines.push(`${name}${formatLabels(c.labels)} ${c.value}`);
    }
  }

  const gaugeNames = new Set(input.gauges.map((g) => g.name));
  for (const name of gaugeNames) {
    lines.push(`# TYPE ${name} gauge`);
    for (const g of input.gauges.filter((x) => x.name === name)) {
      lines.push(`${name}${formatLabels(g.labels)} ${g.value}`);
    }
  }

  const histNames = new Set(input.histograms.map((h) => h.name));
  for (const name of histNames) {
    lines.push(`# TYPE ${name} histogram`);
    for (const h of input.histograms.filter((x) => x.name === name)) {
      const lbl = formatLabels(h.labels);
      for (const [le, count] of Object.entries(h.buckets).sort(
        (a, b) => Number(a[0]) - Number(b[0])
      )) {
        lines.push(`${name}_bucket${lbl.replace('}', `,le="${le}"}`)} ${count}`);
      }
      lines.push(`${name}_sum${lbl} ${h.sum}`);
      lines.push(`${name}_count${lbl} ${h.count}`);
    }
  }

  return lines.join('\n') + '\n';
}
