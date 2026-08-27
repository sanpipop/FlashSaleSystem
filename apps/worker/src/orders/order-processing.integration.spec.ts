import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderJobPayload } from '@flash-sale/contracts';
import { AppDataSource } from '@flash-sale/database';

const enabled = process.env.RUN_DB_INTEGRATION === '1';
const describeIntegration = enabled ? describe : describe.skip;

function job(id: string, userId: string, productId: string): OrderJobPayload {
  return {
    jobId: `ord-integration-${id}`,
    requestId: `req-integration-${id}`,
    userId,
    productId,
    createdAt: new Date().toISOString(),
  };
}

async function clean(productId: string): Promise<void> {
  await AppDataSource.query('DELETE FROM order_results WHERE product_id = $1', [productId]);
  await AppDataSource.query('DELETE FROM orders WHERE product_id = $1', [productId]);
  await AppDataSource.query('DELETE FROM transactional_outbox WHERE aggregate_id = $1', [productId]);
  await AppDataSource.query('DELETE FROM products WHERE product_id = $1', [productId]);
}

async function setup(productId: string, stock: number, active = true): Promise<void> {
  await clean(productId);
  await AppDataSource.query(
    `INSERT INTO products (
      product_id, name, description, price, available_stock, remaining_stock, is_flash_sale_active
    ) VALUES ($1, $2, NULL, 1, $3, $3, $4)`,
    [productId, productId, stock, active],
  );
}

async function processConcurrently(jobs: OrderJobPayload[]): Promise<Array<{ status: string }>> {
  return Promise.all(
    jobs.map(async (payload) => {
      const rows = await AppDataSource.query<Array<{ status: string }>>(
        'SELECT * FROM place_order_batch($1::jsonb)',
        [JSON.stringify([payload])],
      );
      return requireRow(rows);
    }),
  );
}

function requireRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) {
    throw new Error('Expected a database row');
  }
  return row;
}

describeIntegration('place_order_batch PostgreSQL correctness', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });

  afterAll(async () => {
    for (const productId of ['it-stock1', 'it-high', 'it-duplicate', 'it-inactive', 'it-multi-a', 'it-multi-b', 'it-sold-out']) {
      await clean(productId);
    }
    await AppDataSource.destroy();
  });

  it('passes the stock=1 race gate', async () => {
    await setup('it-stock1', 1);
    const jobs = Array.from({ length: 50 }, (_, index) => job(`stock1-${index}`, `it-user-${index}`, 'it-stock1'));
    const results = await processConcurrently(jobs);
    const state = requireRow(await AppDataSource.query<Array<{ remaining_stock: number; successes: string }>>(
      `SELECT remaining_stock,
        (SELECT COUNT(*) FROM orders WHERE product_id = $1) AS successes
       FROM products WHERE product_id = $1`,
      ['it-stock1'],
    ));

    expect(results.filter((result) => result.status === 'SUCCESS')).toHaveLength(1);
    expect(state).toEqual({ remaining_stock: 0, successes: '1' });
  });

  it('passes the high-contention stock=50 gate', async () => {
    await setup('it-high', 50);
    const jobs = Array.from({ length: 100 }, (_, index) => job(`high-${index}`, `it-high-user-${index}`, 'it-high'));
    await processConcurrently(jobs);
    const state = requireRow(await AppDataSource.query<Array<{ remaining_stock: number; successes: string; distinct_users: string }>>(
      `SELECT remaining_stock,
        (SELECT COUNT(*) FROM orders WHERE product_id = $1) AS successes,
        (SELECT COUNT(DISTINCT user_id) FROM orders WHERE product_id = $1) AS distinct_users
       FROM products WHERE product_id = $1`,
      ['it-high'],
    ));

    expect(state).toEqual({ remaining_stock: 0, successes: '50', distinct_users: '50' });
  });

  it('preserves duplicate, retry, and inactive-sale semantics', async () => {
    await setup('it-duplicate', 2);
    const duplicateJobs = [job('duplicate-a', 'it-same-user', 'it-duplicate'), job('duplicate-b', 'it-same-user', 'it-duplicate')];
    const duplicateResults = await processConcurrently(duplicateJobs);
    const retry = requireRow(await AppDataSource.query<Array<{ status: string }>>(
      'SELECT * FROM place_order_batch($1::jsonb)',
      [JSON.stringify([duplicateJobs[0]])],
    ));
    expect(duplicateResults.map((result) => result.status).sort()).toEqual(['REJECTED_DUPLICATE', 'SUCCESS']);
    expect(retry.status).toBe('SUCCESS');

    await setup('it-inactive', 5, false);
    const inactive = requireRow(await AppDataSource.query<Array<{ status: string }>>(
      'SELECT * FROM place_order_batch($1::jsonb)',
      [JSON.stringify([job('inactive', 'it-inactive-user', 'it-inactive')])],
    ));
    expect(inactive.status).toBe('REJECTED_INACTIVE');
    const stock = requireRow(await AppDataSource.query<Array<{ remaining_stock: number }>>(
      'SELECT remaining_stock FROM products WHERE product_id = $1',
      ['it-inactive'],
    ));
    expect(stock.remaining_stock).toBe(5);
  });

  it('allows the same user to buy different products and rejects sold out stock', async () => {
    await setup('it-multi-a', 1);
    await setup('it-multi-b', 1);
    const multiResults = await processConcurrently([
      job('multi-a', 'it-multi-user', 'it-multi-a'),
      job('multi-b', 'it-multi-user', 'it-multi-b'),
    ]);
    expect(multiResults.map((result) => result.status).sort()).toEqual(['SUCCESS', 'SUCCESS']);

    await setup('it-sold-out', 0);
    const soldOut = requireRow(await AppDataSource.query<Array<{ status: string }>>(
      'SELECT * FROM place_order_batch($1::jsonb)',
      [JSON.stringify([job('sold-out', 'it-sold-out-user', 'it-sold-out')])],
    ));
    expect(soldOut.status).toBe('REJECTED_SOLD_OUT');
  });
});
