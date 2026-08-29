import type { OrderJobPayload, OrderJobResult } from '@flash-sale/contracts';
import type { Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MicroBatchCoordinatorService } from './micro-batch-coordinator.service.js';
import type { OrderBatchProcessorService } from './order-batch-processor.service.js';

function payload(index: number): OrderJobPayload {
  return {
    jobId: `ord-${index.toString().padStart(64, '0')}`,
    requestId: `request-${index}`,
    userId: `user-${index}`,
    productId: 'p-1001',
    createdAt: '2026-08-27T00:00:00.000Z',
  };
}

function asJob(data: OrderJobPayload): Job<OrderJobPayload, OrderJobResult> {
  return { data } as Job<OrderJobPayload, OrderJobResult>;
}

function success(data: OrderJobPayload): OrderJobResult {
  return {
    status: 'SUCCESS',
    jobId: data.jobId,
    userId: data.userId,
    productId: data.productId,
    orderId: `order-${data.userId}`,
    processedAt: '2026-08-27T00:00:00.001Z',
    message: 'success',
  };
}

describe('MicroBatchCoordinatorService', () => {
  const originalBatchSize = process.env.WORKER_BATCH_SIZE;
  const originalBatchWait = process.env.WORKER_BATCH_WAIT_MS;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.WORKER_BATCH_SIZE = '3';
    process.env.WORKER_BATCH_WAIT_MS = '1';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.WORKER_BATCH_SIZE = originalBatchSize;
    process.env.WORKER_BATCH_WAIT_MS = originalBatchWait;
  });

  it('sends a full group to PostgreSQL in one batch call', async () => {
    const processBatch = vi.fn((jobs: readonly OrderJobPayload[]) =>
      Promise.resolve(jobs.map(success)),
    );
    const coordinator = new MicroBatchCoordinatorService({
      process: processBatch,
    } as unknown as OrderBatchProcessorService);
    const jobs = [payload(1), payload(2), payload(3)];

    const resultsPromise = Promise.all(jobs.map((job) => coordinator.add(asJob(job))));
    await vi.runAllTimersAsync();
    const results = await resultsPromise;

    expect(processBatch).toHaveBeenCalledTimes(1);
    expect(processBatch).toHaveBeenCalledWith(jobs);
    expect(results.map((result) => result.jobId)).toEqual(
      jobs.map((job) => job.jobId),
    );
  });

  it('flushes a partial group after the bounded wait', async () => {
    const processBatch = vi.fn((jobs: readonly OrderJobPayload[]) =>
      Promise.resolve(jobs.map(success)),
    );
    const coordinator = new MicroBatchCoordinatorService({
      process: processBatch,
    } as unknown as OrderBatchProcessorService);
    const jobs = [payload(1), payload(2)];

    const resultsPromise = Promise.all(jobs.map((job) => coordinator.add(asJob(job))));
    await vi.advanceTimersByTimeAsync(1);
    await resultsPromise;

    expect(processBatch).toHaveBeenCalledTimes(1);
    expect(processBatch).toHaveBeenCalledWith(jobs);
  });

  it('rejects every BullMQ callback when a transient database call fails', async () => {
    const failure = new Error('database disconnected');
    const coordinator = new MicroBatchCoordinatorService({
      process: vi.fn().mockRejectedValue(failure),
    } as unknown as OrderBatchProcessorService);

    const resultsPromise = Promise.allSettled([
      coordinator.add(asJob(payload(1))),
      coordinator.add(asJob(payload(2))),
    ]);
    await vi.advanceTimersByTimeAsync(1);
    const results = await resultsPromise;

    expect(results).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ]);
  });
});
