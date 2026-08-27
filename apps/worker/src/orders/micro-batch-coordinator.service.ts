import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { OrderJobPayload, OrderJobResult } from '@flash-sale/contracts';
import type { Job } from 'bullmq';
import { OrderBatchProcessorService } from './order-batch-processor.service.js';
import { workerSettingsFromEnv } from './worker-settings.js';

interface PendingJob {
  job: Job<OrderJobPayload, OrderJobResult>;
  resolve: (result: OrderJobResult) => void;
  reject: (error: unknown) => void;
}

@Injectable()
export class MicroBatchCoordinatorService implements OnModuleDestroy {
  private readonly settings = workerSettingsFromEnv();
  private readonly pending: PendingJob[] = [];
  private timer: NodeJS.Timeout | undefined;
  private flushChain: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    @Inject(OrderBatchProcessorService)
    private readonly processor: OrderBatchProcessorService,
  ) {}

  add(job: Job<OrderJobPayload, OrderJobResult>): Promise<OrderJobResult> {
    if (this.stopped) {
      return Promise.reject(new Error('Order micro-batch coordinator is stopping.'));
    }

    const resultPromise = new Promise<OrderJobResult>((resolve, reject) => {
      this.pending.push({ job, resolve, reject });
    });

    if (this.pending.length >= this.settings.batchSize) {
      this.scheduleFlush(0);
    } else if (this.timer === undefined) {
      this.scheduleFlush(this.settings.batchWaitMs);
    }

    return resultPromise;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.clearTimer();

    if (this.pending.length > 0) {
      this.enqueueFlush();
    }

    await this.flushChain;
  }

  private scheduleFlush(delayMs: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.enqueueFlush();
    }, delayMs);
  }

  private enqueueFlush(): void {
    this.flushChain = this.flushChain.then(() => this.flushOneBatch());
  }

  private async flushOneBatch(): Promise<void> {
    const batch = this.pending.splice(0, this.settings.batchSize);

    if (batch.length === 0) {
      return;
    }

    try {
      const results = await this.processor.process(batch.map(({ job }) => job.data));
      const resultByJobId = new Map(results.map((result) => [result.jobId, result]));

      for (const pendingJob of batch) {
        const result = resultByJobId.get(pendingJob.job.data.jobId);

        if (result === undefined) {
          throw new Error(`Missing result for jobId: ${pendingJob.job.data.jobId}`);
        }

        pendingJob.resolve(result);
      }
    } catch (error) {
      for (const pendingJob of batch) {
        pendingJob.reject(error);
      }
    } finally {
      if (this.pending.length >= this.settings.batchSize) {
        this.scheduleFlush(0);
      } else if (this.pending.length > 0 && this.timer === undefined) {
        this.scheduleFlush(this.settings.batchWaitMs);
      }
    }
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
