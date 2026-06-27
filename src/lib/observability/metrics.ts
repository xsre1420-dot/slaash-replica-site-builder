import { buildEventBase } from './context';
import { enqueueEvent } from './reporter';

export const increment = (name: string, tags?: Record<string, string>, value = 1) => {
  const base = buildEventBase();
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
