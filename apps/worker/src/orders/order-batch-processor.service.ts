import { Injectable } from '@nestjs/common';
import type { OrderJobPayload, OrderJobResult } from '@flash-sale/contracts';
import { AppDataSource, placeOrderBatch } from '@flash-sale/database';

@Injectable()
export class OrderBatchProcessorService {
  private batchCalls = 0;
  private processedJobs = 0;

  get statistics(): Readonly<{ batchCalls: number; processedJobs: number }> {
    return {
      batchCalls: this.batchCalls,
      processedJobs: this.processedJobs,
    };
  }

  async process(jobs: readonly OrderJobPayload[]): Promise<OrderJobResult[]> {
    const distinctJobs = [...new Map(jobs.map((job) => [job.jobId, job])).values()];
    const payloadByJobId = new Map(distinctJobs.map((job) => [job.jobId, job]));
    const databaseResults = await placeOrderBatch(AppDataSource, distinctJobs);
    const processedAt = new Date().toISOString();

    this.batchCalls += 1;
    this.processedJobs += distinctJobs.length;

    if (databaseResults.length !== distinctJobs.length) {
      throw new Error(
        `Database returned ${databaseResults.length} results for ${distinctJobs.length} jobs.`,
      );
    }

    return databaseResults.map((result) => {
      const payload = payloadByJobId.get(result.jobId);

      if (payload === undefined) {
        throw new Error(`Database returned an unknown jobId: ${result.jobId}`);
      }

      return {
        status: result.status,
        jobId: payload.jobId,
        userId: payload.userId,
        productId: payload.productId,
        ...(result.orderId === undefined ? {} : { orderId: result.orderId }),
        processedAt,
        message: result.message,
      };
    });
  }
}
