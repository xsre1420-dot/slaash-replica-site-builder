/** Run async tasks with a fixed concurrency limit (avoids sequential N+1 client calls). */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<boolean>
): Promise<number> {
  if (items.length === 0) return 0;

  let index = 0;
  let succeeded = 0;

  const worker = async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (await fn(current)) succeeded += 1;
    }
  };

  const workers = Array.from(
    { length: Math.min(Math.max(concurrency, 1), items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return succeeded;
}
