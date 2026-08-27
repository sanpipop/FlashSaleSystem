import type { DataSource } from 'typeorm';

export interface PlaceOrderBatchInput {
  jobId: string;
  requestId: string;
  userId: string;
  productId: string;
  createdAt: string;
}

export type PlaceOrderBatchStatus =
  | 'SUCCESS'
  | 'REJECTED_SOLD_OUT'
  | 'REJECTED_INACTIVE'
  | 'REJECTED_DUPLICATE';

interface PlaceOrderBatchRow {
  job_id: string;
  status: PlaceOrderBatchStatus;
  order_id: string | null;
  message: string;
}

export interface PlaceOrderBatchResult {
  jobId: string;
  status: PlaceOrderBatchStatus;
  orderId?: string;
  message: string;
}

export async function placeOrderBatch(
  dataSource: DataSource,
  jobs: readonly PlaceOrderBatchInput[],
): Promise<PlaceOrderBatchResult[]> {
  if (!dataSource.isInitialized) {
    throw new Error('PostgreSQL data source is not initialized.');
  }

  if (jobs.length < 1 || jobs.length > 32) {
    throw new Error('placeOrderBatch accepts between 1 and 32 jobs.');
  }

  const rows = await dataSource.query<PlaceOrderBatchRow[]>(
    'SELECT * FROM place_order_batch($1::jsonb)',
    [JSON.stringify(jobs)],
  );

  return rows.map((row) => ({
    jobId: row.job_id,
    status: row.status,
    ...(row.order_id === null ? {} : { orderId: row.order_id }),
    message: row.message,
  }));
}
