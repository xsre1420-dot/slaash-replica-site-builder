/**
 * OpenTelemetry metrics JSON shape — wire to OTLP collector without SDK lock-in.
 */
import type { CollectedCounter, CollectedGauge, CollectedHistogram } from '../metricCollector';

export function formatOtelMetrics(input: {
  counters: CollectedCounter[];
  gauges: CollectedGauge[];
  histograms: CollectedHistogram[];
  resourceAttributes?: Record<string, string>;
}): {
  resourceMetrics: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
    scopeMetrics: Array<{
      metrics: Array<{
        name: string;
        unit: string;
        sum?: { dataPoints: Array<{ asInt: number; attributes: Array<{ key: string; value: { stringValue: string } }> }> };
        gauge?: { dataPoints: Array<{ asDouble: number; attributes: Array<{ key: string; value: { stringValue: string } }> }> };
        histogram?: {
          dataPoints: Array<{
            count: number;
            sum: number;
            bucketCounts: number[];
            explicitBounds: number[];
            attributes: Array<{ key: string; value: { stringValue: string } }>;
          }>;
        };
      }>;
    }>;
  }>;
} {
  const toAttrs = (labels: Record<string, string>) =>
    Object.entries(labels).map(([key, value]) => ({
      key,
      value: { stringValue: value },
    }));

  const resourceAttrs = Object.entries(input.resourceAttributes ?? { service: 'slaash-platform' }).map(
    ([key, value]) => ({ key, value: { stringValue: value } })
  );

  const metrics: Array<{
    name: string;
    unit: string;
    sum?: { dataPoints: Array<{ asInt: number; attributes: ReturnType<typeof toAttrs> }> };
    gauge?: { dataPoints: Array<{ asDouble: number; attributes: ReturnType<typeof toAttrs> }> };
    histogram?: {
      dataPoints: Array<{
        count: number;
        sum: number;
        bucketCounts: number[];
        explicitBounds: number[];
        attributes: ReturnType<typeof toAttrs>;
      }>;
    };
  }> = [];

  for (const c of input.counters) {
    metrics.push({
      name: c.name,
      unit: '1',
      sum: { dataPoints: [{ asInt: c.value, attributes: toAttrs(c.labels) }] },
    });
  }

  for (const g of input.gauges) {
    metrics.push({
      name: g.name,
      unit: '1',
      gauge: { dataPoints: [{ asDouble: g.value, attributes: toAttrs(g.labels) }] },
    });
  }

  for (const h of input.histograms) {
    const bounds = Object.keys(h.buckets)
      .map(Number)
      .sort((a, b) => a - b);
    const bucketCounts = bounds.map((b) => h.buckets[b] ?? 0);
    metrics.push({
      name: h.name,
      unit: 'ms',
      histogram: {
        dataPoints: [
          {
            count: h.count,
            sum: h.sum,
            bucketCounts,
            explicitBounds: bounds,
            attributes: toAttrs(h.labels),
          },
        ],
      },
    });
  }

  return {
    resourceMetrics: [
      {
        resource: { attributes: resourceAttrs },
        scopeMetrics: [{ metrics }],
      },
    ],
  };
}
