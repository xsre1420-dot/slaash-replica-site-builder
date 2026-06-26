/**
 * Small helpers to avoid timers and promises retaining memory after unmount.
 */

export type CancelToken = { cancelled: boolean };

export function createCancelToken(): CancelToken {
  return { cancelled: false };
}

export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
): { race: Promise<T>; clear: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const race = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error('timeout'));
    }, timeoutMs);

    promise
      .then((value) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
  });

  return {
    race,
    clear: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/** Track timeouts created outside React effects (e.g. auth callbacks). */
export class TimeoutRegistry {
  private ids = new Set<ReturnType<typeof setTimeout>>();

  schedule(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.ids.delete(id);
      fn();
    }, ms);
    this.ids.add(id);
    return id;
  }

  clearAll(): void {
    for (const id of this.ids) clearTimeout(id);
    this.ids.clear();
  }
}
