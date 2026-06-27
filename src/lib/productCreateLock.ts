import { generateUUID } from '@/lib/uuid';

export interface AddProductResult {
  success: boolean;
  productId?: string;
  error?: string;
}

const inflightByKey = new Map<string, Promise<AddProductResult>>();

/** Prevent duplicate inserts from double-clicks / parallel submit handlers */
export const runOncePerKey = (
  key: string,
  task: () => Promise<AddProductResult>
): Promise<AddProductResult> => {
  const existing = inflightByKey.get(key);
  if (existing) return existing;

  const promise = task().finally(() => {
    window.setTimeout(() => inflightByKey.delete(key), 15_000);
  });

  inflightByKey.set(key, promise);
  return promise;
};

export const createProductIdempotencyKey = (): string => generateUUID();
