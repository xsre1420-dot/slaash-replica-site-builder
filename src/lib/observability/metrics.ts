import { buildEventBase } from './correlation';
import { enqueueEvent } from './reporter';
import { syncObservabilityMetric, recordCheckout, recordStorefrontPageView } from '@/lib/monitoring/instrumentation';

function bridgeCanonicalMetric(name: string, tags?: Record<string, string>): void {
  if (name === 'checkout.submit.started') recordCheckout({ phase: 'started' });
  else if (name === 'checkout.submit.success') recordCheckout({ phase: 'success' });
  else if (name === 'checkout.submit.failed') recordCheckout({ phase: 'failed' });
  else if (name === 'checkout.submit.recovered') recordCheckout({ phase: 'recovered' });
  else if (name === 'checkout.submit.idempotent') recordCheckout({ phase: 'idempotent' });
  else if (name === 'page.view') recordStorefrontPageView(tags?.path ?? '/');
}

export const increment = (name: string, tags?: Record<string, string>, value = 1) => {
  const base = buildEventBase();
  syncObservabilityMetric(name, value, 'count', tags);
  bridgeCanonicalMetric(name, tags);
  enqueueEvent({
    type: 'metric',
    name,
    value,
    unit: 'count',
    tags,
    ...base,
  });
};

export const timing = (name: string, durationMs: number, tags?: Record<string, string>) => {
  const base = buildEventBase();
  syncObservabilityMetric(name, durationMs, 'ms', tags);
  enqueueEvent({
    type: 'metric',
    name,
    value: Math.round(durationMs),
    unit: 'ms',
    tags,
    ...base,
  });
};

export const gauge = (name: string, value: number, tags?: Record<string, string>) => {
  const base = buildEventBase();
  syncObservabilityMetric(name, value, 'bytes', tags);
  enqueueEvent({
    type: 'metric',
    name,
    value,
    unit: 'bytes',
    tags,
    ...base,
  });
};

export const metrics = { increment, timing, gauge };
