import type { BackgroundJob } from '@/background/shared/types';

const deadLetter: BackgroundJob[] = [];
const MAX_DLQ = 200;

export function pushToDeadLetter(job: BackgroundJob): void {
  deadLetter.unshift({ ...job, status: 'dead_letter' });
  if (deadLetter.length > MAX_DLQ) deadLetter.length = MAX_DLQ;
}

export function getDeadLetterJobs(queue?: string): BackgroundJob[] {
  if (!queue) return [...deadLetter];
  return deadLetter.filter((j) => j.queue === queue);
}

export function clearDeadLetterForTests(): void {
  deadLetter.length = 0;
}
