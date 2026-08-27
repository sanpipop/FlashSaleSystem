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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WorkerModule } from '../worker.module.js';
import { OrderBatchProcessorService } from './order-batch-processor.service.js';

interface IntegritySnapshot {
  remainingStock: number;
  orders: number;
  results: number;
  successes: number;
  duplicates: number;
  orphanSuccesses: number;
  negativeStocks: number;
}

const PRODUCT_ID = 'p-1001';
const POLL_INTERVAL_MS = 20;
const DRAIN_TIMEOUT_MS = 30_000;

function makeJob(userId: string, productId = PRODUCT_ID): OrderJobPayload {
  return {
    jobId: createOrderJobId(userId, productId),
    requestId: `request-${userId}-${productId}`,
    userId,
    productId,
    createdAt: new Date().toISOString(),
  };
}

async function resetState(remainingStock: number): Promise<void> {
  await AppDataSource.transaction(async (manager) => {
    await manager.query('DELETE FROM transactional_outbox');
    await manager.query('DELETE FROM order_results');
    await manager.query('DELETE FROM orders');
    await manager.query(
      `
        UPDATE products
        SET remaining_stock = $1, is_flash_sale_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
      `,
      [remainingStock, PRODUCT_ID],
    );
  });
}

async function waitForQueueDrain(queue: OrdersQueue): Promise<void> {
  const deadline = Date.now() + DRAIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');

    if ((counts.failed ?? 0) > 0) {
      throw new Error(`Queue contains ${counts.failed ?? 0} failed jobs.`);
    }

    if (counts.waiting === 0 && counts.active === 0 && counts.delayed === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Queue did not drain within ${DRAIN_TIMEOUT_MS} ms.`);
}

async function integritySnapshot(): Promise<IntegritySnapshot> {
  const [row] = await AppDataSource.query<
    Array<{
      remaining_stock: number;
      orders: string;
      results: string;
      successes: string;
      duplicates: string;
      orphan_successes: string;
      negative_stocks: string;
    }>
  >(`
    SELECT
      (SELECT remaining_stock FROM products WHERE product_id = '${PRODUCT_ID}') AS remaining_stock,
      (SELECT COUNT(*) FROM orders WHERE product_id = '${PRODUCT_ID}') AS orders,
      (SELECT COUNT(*) FROM order_results WHERE product_id = '${PRODUCT_ID}') AS results,
      (SELECT COUNT(*) FROM order_results WHERE product_id = '${PRODUCT_ID}' AND status = 'SUCCESS') AS successes,
      (
        SELECT COUNT(*)
        FROM (
          SELECT user_id, product_id
          FROM orders
          GROUP BY user_id, product_id
          HAVING COUNT(*) > 1
        ) AS duplicate_orders
      ) AS duplicates,
      (
        SELECT COUNT(*)
        FROM order_results AS result
        LEFT JOIN orders AS placed_order ON placed_order.id = result.order_id
        WHERE result.status = 'SUCCESS' AND placed_order.id IS NULL
      ) AS orphan_successes,
      (SELECT COUNT(*) FROM products WHERE remaining_stock < 0) AS negative_stocks
  `);

  if (row === undefined) {
    throw new Error('Integrity query returned no result.');
  }

  return {
    remainingStock: row.remaining_stock,
    orders: Number(row.orders),
    results: Number(row.results),
    successes: Number(row.successes),
    duplicates: Number(row.duplicates),
    orphanSuccesses: Number(row.orphan_successes),
    negativeStocks: Number(row.negative_stocks),
  };
}

describe('Order processing with real PostgreSQL, Redis, and BullMQ', () => {
  let app: INestApplicationContext;
  let queue: OrdersQueue;
  let processor: OrderBatchProcessorService;

  beforeAll(async () => {
    queue = createOrdersQueue(redisOpsConnectionFromEnv());
    await queue.waitUntilReady();
    await queue.obliterate({ force: true });

    app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
    processor = app.get(OrderBatchProcessorService);
  });

  beforeEach(async () => {
    await waitForQueueDrain(queue);
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await app?.close();
    await queue?.close();
  });

  it('sells exactly 50 items to 500 concurrent unique users without overselling', async () => {
    await resetState(50);
    const jobs = Array.from({ length: 500 }, (_, index) =>
      makeJob(`day2-user-${index.toString().padStart(3, '0')}`),
    );
    const callsBefore = processor.statistics.batchCalls;

    await Promise.all(jobs.map((job) => enqueueOrderJob(queue, job)));
    await waitForQueueDrain(queue);

    const snapshot = await integritySnapshot();
    const batchCalls = processor.statistics.batchCalls - callsBefore;

    expect(snapshot).toEqual({
      remainingStock: 0,
      orders: 50,
      results: 500,
      successes: 50,
      duplicates: 0,
      orphanSuccesses: 0,
      negativeStocks: 0,
    });
    expect(batchCalls).toBeGreaterThan(0);
    expect(batchCalls).toBeLessThan(jobs.length);
  });

  it('returns the durable result when the same completed job is delivered again', async () => {
    await resetState(1);
    const job = makeJob('retry-user');

    await enqueueOrderJob(queue, job);
    await waitForQueueDrain(queue);
    const firstSnapshot = await integritySnapshot();

    await queue.remove(job.jobId);
    await enqueueOrderJob(queue, job);
    await waitForQueueDrain(queue);
    const retrySnapshot = await integritySnapshot();

    expect(firstSnapshot.orders).toBe(1);
    expect(firstSnapshot.remainingStock).toBe(0);
    expect(retrySnapshot).toEqual(firstSnapshot);
  });

  it('passes the stock-one race gate for 50 concurrent users', async () => {
    await resetState(1);
    const jobs = Array.from({ length: 50 }, (_, index) =>
      makeJob(`race-user-${index.toString().padStart(2, '0')}`),
    );

    await Promise.all(jobs.map((job) => enqueueOrderJob(queue, job)));
    await waitForQueueDrain(queue);

    const snapshot = await integritySnapshot();

    expect(snapshot.remainingStock).toBe(0);
    expect(snapshot.orders).toBe(1);
    expect(snapshot.results).toBe(50);
    expect(snapshot.successes).toBe(1);
    expect(snapshot.duplicates).toBe(0);
    expect(snapshot.orphanSuccesses).toBe(0);
    expect(snapshot.negativeStocks).toBe(0);
  });

  it('persists an inactive-sale rejection without failing the BullMQ job', async () => {
    await resetState(5);
    await AppDataSource.query(
      `
        UPDATE products
        SET is_flash_sale_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $1
      `,
      [PRODUCT_ID],
    );
    const job = makeJob('inactive-sale-user');

    await enqueueOrderJob(queue, job);
    await waitForQueueDrain(queue);

    const [result] = await AppDataSource.query<
      Array<{ status: string; remaining_stock: number }>
    >(
      `
        SELECT result.status, product.remaining_stock
        FROM order_results AS result
        INNER JOIN products AS product ON product.product_id = result.product_id
        WHERE result.job_id = $1
      `,
      [job.jobId],
    );

    expect(result).toEqual({
      status: 'REJECTED_INACTIVE',
      remaining_stock: 5,
    });
  });

  it('allows the same user to purchase two different products', async () => {
    await resetState(1);
    await AppDataSource.query(
      `
        UPDATE products
        SET remaining_stock = 1, is_flash_sale_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $1
      `,
      ['p-1002'],
    );
    const jobs = [makeJob('multi-product-user'), makeJob('multi-product-user', 'p-1002')];

    await Promise.all(jobs.map((job) => enqueueOrderJob(queue, job)));
    await waitForQueueDrain(queue);

    const [result] = await AppDataSource.query<
      Array<{ order_count: string; product_count: string }>
    >(
      `
        SELECT
          COUNT(*) AS order_count,
          COUNT(DISTINCT product_id) AS product_count
        FROM orders
        WHERE user_id = $1
      `,
      ['multi-product-user'],
    );

    expect(result).toEqual({ order_count: '2', product_count: '2' });
  });
});
