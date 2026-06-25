import { callSupabaseRpc } from '@/integrations/supabase/rpc';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import { instrumentAsync } from '@/lib/observability';
import type { BulkImportRow } from '@/services/productsCrudService';

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type EnqueueImportJobResult = {
  success: boolean;
  jobId?: string;
  totalRows?: number;
  error?: string;
};

export type ProcessImportBatchResult = {
  success: boolean;
  jobId?: string;
  status?: ImportJobStatus;
  processedRows?: number;
  totalRows?: number;
  batchSuccess?: number;
  batchFailed?: number;
  done?: boolean;
  error?: string;
};

const mapBulkRowsToPayload = (rows: BulkImportRow[]) =>
  rows.map((row) => ({
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    cost: row.cost ?? null,
    stock_quantity: row.stock_quantity ?? 0,
    sizes: row.sizes ?? null,
    image_url: row.image_url ?? null,
  }));

/** Queue a large CSV import for background batch processing. */
export async function enqueueProductImportJob(
  ownerId: string,
  storeId: string | null,
  rows: BulkImportRow[]
): Promise<EnqueueImportJobResult> {
  await assertMerchantOwner(ownerId);

  return instrumentAsync('import.enqueue', async () => {
    const { data, error } = await callSupabaseRpc<{
      success?: boolean;
      job_id?: string;
      total_rows?: number;
      error?: string;
    }>('enqueue_product_import_job', {
      p_owner_id: ownerId,
      p_store_id: storeId,
      p_rows: mapBulkRowsToPayload(rows),
    });

    if (error || !data?.success || !data.job_id) {
      return { success: false, error: error ?? data?.error ?? 'فشل إنشاء مهمة الاستيراد' };
    }

    return {
      success: true,
      jobId: data.job_id,
      totalRows: data.total_rows ?? rows.length,
    };
  }, { ownerId, rowCount: rows.length });
}

/** Process one batch of a queued import job (client-driven or edge worker). */
export async function processProductImportBatch(
  jobId: string,
  batchSize = 25
): Promise<ProcessImportBatchResult> {
  return instrumentAsync('import.processBatch', async () => {
    const { data, error } = await callSupabaseRpc<{
      success?: boolean;
      job_id?: string;
      status?: ImportJobStatus;
      processed_rows?: number;
      total_rows?: number;
      batch_success?: number;
      batch_failed?: number;
      done?: boolean;
      error?: string;
    }>('process_product_import_batch', {
      p_job_id: jobId,
      p_batch_size: batchSize,
    });

    if (error || data?.success === false) {
      return { success: false, error: error ?? data?.error ?? 'فشل معالجة الدفعة' };
    }

    return {
      success: true,
      jobId: data?.job_id ?? jobId,
      status: data?.status,
      processedRows: data?.processed_rows,
      totalRows: data?.total_rows,
      batchSuccess: data?.batch_success,
      batchFailed: data?.batch_failed,
      done: data?.done,
    };
  }, { jobId, batchSize });
}

/** Run all remaining batches until the job completes. */
export async function runImportJobToCompletion(
  jobId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<ProcessImportBatchResult> {
  let last: ProcessImportBatchResult = { success: false, error: 'not_started' };

  for (let guard = 0; guard < 400; guard++) {
    last = await processProductImportBatch(jobId);
    if (!last.success) return last;

    if (last.processedRows != null && last.totalRows != null) {
      onProgress?.(last.processedRows, last.totalRows);
    }

    if (last.done || last.status === 'completed' || last.status === 'failed') {
      return last;
    }
  }

  return { success: false, error: 'تجاوزت مهمة الاستيراد الحد الأقصى للدفعات' };
}
