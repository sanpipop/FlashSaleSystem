import { Injectable } from '@nestjs/common';
import type { OrderJobPayload, OrderJobResult } from '@flash-sale/contracts';
import { OrderBatchProcessorService } from './order-batch-processor.service.js';

interface PendingJob {
  payload: OrderJobPayload;
  resolve: (result: OrderJobResult) => void;
  reject: (error: unknown) => void;
}

@Injectable()
export class OrderBatchCoordinatorService {
  private readonly batchSize = this.positiveEnv('WORKER_BATCH_SIZE', 16);
  private readonly waitMs = this.nonNegativeEnv('WORKER_BATCH_WAIT_MS', 1);
  private pending: PendingJob[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;
  private flushing?: Promise<void>;

  constructor(private readonly processor: OrderBatchProcessorService) {}

  submit(payload: OrderJobPayload): Promise<OrderJobResult> {
    return new Promise((resolve, reject) => {
      this.pending.push({ payload, resolve, reject });
      if (this.pending.length >= this.batchSize) {
        void this.flush();
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = undefined;
          void this.flush();
        }, this.waitMs);
      }
    });
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing) {
      return this.flushing;
    }
    if (this.pending.length === 0) {
      return;
    }

    const batch = this.pending.splice(0, this.batchSize);
    this.flushing = this.processBatch(batch).finally(() => {
      this.flushing = undefined;
      if (this.pending.length > 0) {
        void this.flush();
      }
    });
    return this.flushing;
  }

  private async processBatch(batch: PendingJob[]): Promise<void> {
    try {
      const results = await this.processor.process(batch.map((item) => item.payload));
      const resultByJob = new Map(results.map((result) => [result.jobId, result]));
      for (const item of batch) {
        const result = resultByJob.get(item.payload.jobId);
        if (!result) {
          item.reject(new Error(`Missing result for job ${item.payload.jobId}`));
        } else {
          item.resolve(result);
        }
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error);
      }
    }
  }

  private positiveEnv(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private nonNegativeEnv(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }
}
