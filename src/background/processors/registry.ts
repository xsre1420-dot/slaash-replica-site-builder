import type { BackgroundJob } from '@/background/shared/types';

export type JobProcessor = (job: BackgroundJob) => Promise<void>;

const processors = new Map<string, JobProcessor>();

export function registerProcessor(type: string, fn: JobProcessor): void {
  processors.set(type, fn);
}

export function getProcessor(type: string): JobProcessor | undefined {
  return processors.get(type);
}

export function listRegisteredProcessorTypes(): string[] {
  return [...processors.keys()];
}
