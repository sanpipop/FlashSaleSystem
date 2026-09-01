import { Inject, Injectable } from '@nestjs/common';
import type { OrderJobPayload, OrderJobResult } from '@flash-sale/contracts';
import { AppDataSource, placeOrderBatch } from '@flash-sale/database';
import { performance } from 'node:perf_hooks';
import { WorkerMetricsService } from '../common/metrics/worker-metrics.service.js';
import { writeStructuredLog } from '../common/logger/structured-log.js';
import { OutboxRelayService } from '../outbox/outbox-relay.service.js';

@Injectable()
export class OrderBatchProcessorService {
  private batchCalls = 0;
  private processedJobs = 0;

  constructor(
    @Inject(OutboxRelayService)
    private readonly outboxRelay: OutboxRelayService,
    @Inject(WorkerMetricsService)
    private readonly metrics: WorkerMetricsService,
  ) {}

  get statistics(): Readonly<{ batchCalls: number; processedJobs: number }> {
    return {
      batchCalls: this.batchCalls,
      processedJobs: this.processedJobs,
    };
  }

  async process(jobs: readonly OrderJobPayload[]): Promise<OrderJobResult[]> {
    const startedAt = performance.now();
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

    let stockByProductId = new Map<string, number>();
    try {
      const productIds = [...new Set(distinctJobs.map((job) => job.productId))];
      const stockRows = await AppDataSource.query<{ product_id: string; remaining_stock: number }[]>(
        'SELECT product_id, remaining_stock FROM products WHERE product_id = ANY($1)',
        [productIds],
      );
      stockByProductId = new Map(stockRows.map((r) => [r.product_id, Number(r.remaining_stock)]));
    } catch {
      // Best-effort stock lookup
    }

    const results = databaseResults.map((result) => {
      const payload = payloadByJobId.get(result.jobId);

      if (payload === undefined) {
        throw new Error(`Database returned an unknown jobId: ${result.jobId}`);
      }

      const currentRemaining = result.status === 'REJECTED_SOLD_OUT'
        ? 0
        : stockByProductId.get(payload.productId);

      return {
        status: result.status,
        jobId: payload.jobId,
        userId: payload.userId,
        productId: payload.productId,
        ...(result.orderId === undefined ? {} : { orderId: result.orderId }),
        ...(currentRemaining === undefined ? {} : { remainingStock: currentRemaining }),
        processedAt,
        message: result.message,
      };
    });

    const durationMs = performance.now() - startedAt;
    this.metrics.observeBatch(results, durationMs);
    for (const result of results.filter((item) => item.status === 'SUCCESS')) {
      writeStructuredLog('info', {
        event: 'ORDER_PROCESSED',
        requestId: payloadByJobId.get(result.jobId)?.requestId,
        jobId: result.jobId,
        userId: result.userId,
        productId: result.productId,
        outcome: result.status,
        durationMs: Number(durationMs.toFixed(3)),
      });
    }
    const rejected = results.filter((result) => result.status !== 'SUCCESS');
    if (rejected.length > 0) {
      const representative = rejected[0];
      writeStructuredLog('info', {
        event: 'ORDER_BATCH_REJECTIONS',
        requestId:
          representative === undefined
            ? undefined
            : payloadByJobId.get(representative.jobId)?.requestId,
        jobId: representative?.jobId,
        productId: representative?.productId,
        outcome: 'BUSINESS_REJECTIONS',
        rejectedJobs: rejected.length,
        durationMs: Number(durationMs.toFixed(3)),
      });
    }
    if (results.some((result) => result.status === 'SUCCESS')) {
      await this.outboxRelay.publishPendingNow();
    }
    return results;
  }
}
