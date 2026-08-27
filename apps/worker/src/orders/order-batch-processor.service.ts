import { Injectable, Logger } from '@nestjs/common';
import type { OrderJobPayload, OrderJobResult } from '@flash-sale/contracts';
import { AppDataSource } from '@flash-sale/database';

interface DatabaseOrderResult {
  job_id: string;
  status: OrderJobResult['status'];
  order_id: string | null;
  message: string;
}

@Injectable()
export class OrderBatchProcessorService {
  private readonly logger = new Logger(OrderBatchProcessorService.name);

  async process(jobs: OrderJobPayload[]): Promise<OrderJobResult[]> {
    const rows = await AppDataSource.query<DatabaseOrderResult[]>(
      'SELECT * FROM place_order_batch($1::jsonb)',
      [JSON.stringify(jobs)],
    );
    const results = new Map(rows.map((row) => [row.job_id, row]));

    return jobs.map((job) => {
      const row = results.get(job.jobId);
      if (!row) {
        throw new Error(`Database returned no result for job ${job.jobId}`);
      }
      const result: OrderJobResult = {
        status: row.status,
        jobId: row.job_id,
        userId: job.userId,
        productId: job.productId,
        processedAt: new Date().toISOString(),
        message: row.message,
      };
      if (row.order_id) {
        result.orderId = row.order_id;
      }
      this.logger.log(JSON.stringify({
        event: 'ORDER_PROCESSED',
        jobId: result.jobId,
        requestId: job.requestId,
        productId: result.productId,
        outcome: result.status,
      }));
      return result;
    });
  }
}
