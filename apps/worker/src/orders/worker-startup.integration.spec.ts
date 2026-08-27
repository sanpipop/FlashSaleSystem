import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { OrderJobPayload } from '@flash-sale/contracts';
import { AppDataSource } from '@flash-sale/database';
import {
  createOrderJobId,
  createOrdersQueue,
  enqueueOrderJob,
  redisOpsConnectionFromEnv,
  type OrdersQueue,
} from '@flash-sale/queue';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkerModule } from '../worker.module.js';

const productId = 'it-worker-startup-backlog';
const userId = 'it-worker-startup-user';
const jobId = createOrderJobId(userId, productId);
const timeoutMs = 15_000;

function payload(): OrderJobPayload {
  return {
    jobId,
    requestId: '123e4567-e89b-42d3-a456-426614174000',
    userId,
    productId,
    createdAt: new Date().toISOString(),
  };
}

async function waitForCompletedJob(queue: OrdersQueue): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await queue.getJob(jobId);
    const state = await job?.getState();
    if (state === 'completed') {
      expect(job?.attemptsMade).toBe(1);
      return;
    }
    if (state === 'failed') {
      throw new Error(`Backlog job failed: ${job?.failedReason ?? 'unknown reason'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Queued backlog job did not complete before timeout.');
}

describe('worker startup with a queued backlog', () => {
  let app: INestApplicationContext | undefined;
  let queue: OrdersQueue | undefined;

  beforeAll(async () => {
    queue = createOrdersQueue(redisOpsConnectionFromEnv());
    await queue.waitUntilReady();
    await queue.obliterate({ force: true });

    await AppDataSource.initialize();
    await AppDataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM transactional_outbox WHERE aggregate_id = $1', [productId]);
      await manager.query('DELETE FROM order_results WHERE product_id = $1', [productId]);
      await manager.query('DELETE FROM orders WHERE product_id = $1', [productId]);
      await manager.query('DELETE FROM products WHERE product_id = $1', [productId]);
      await manager.query(
        `INSERT INTO products (
          product_id, name, price, available_stock, remaining_stock, is_flash_sale_active
        ) VALUES ($1, $2, 1, 1, 1, true)`,
        [productId, productId],
      );
    });
    await AppDataSource.destroy();

    await enqueueOrderJob(queue, payload());
    app = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  });

  afterAll(async () => {
    await app?.close();
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    await AppDataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM transactional_outbox WHERE aggregate_id = $1', [productId]);
      await manager.query('DELETE FROM order_results WHERE product_id = $1', [productId]);
      await manager.query('DELETE FROM orders WHERE product_id = $1', [productId]);
      await manager.query('DELETE FROM products WHERE product_id = $1', [productId]);
    });
    await AppDataSource.destroy();
    await queue?.obliterate({ force: true });
    await queue?.close();
  });

  it('initializes PostgreSQL before consuming a pre-existing order job', async () => {
    if (queue === undefined) {
      throw new Error('Orders queue was not initialized.');
    }

    await waitForCompletedJob(queue);
    const [result] = await AppDataSource.query<Array<{ status: string; order_count: string }>>(
      `SELECT
        result.status,
        (SELECT COUNT(*) FROM orders WHERE job_id = $1) AS order_count
       FROM order_results AS result
       WHERE result.job_id = $1`,
      [jobId],
    );

    expect(result).toEqual({ status: 'SUCCESS', order_count: '1' });
  });
});
