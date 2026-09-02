import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { orderClaimKey } from '@flash-sale/cache';
import { redisOpsConnectionFromEnv } from '@flash-sale/queue';
import { ApiException } from '../common/api-exception.js';
import { OrderClaimService } from './order-claim.service.js';
import { OrdersService } from './orders.service.js';

const testUserId = 'it-admission-remediation-user';
const testProductId = 'p-1001';
const testClaimKey = orderClaimKey(testUserId, testProductId);

interface ObservabilitySpies {
  startRedisClaim: ReturnType<typeof vi.fn>;
  finishRedisClaim: ReturnType<typeof vi.fn>;
  startDuplicateLookup: ReturnType<typeof vi.fn>;
  finishDuplicateLookup: ReturnType<typeof vi.fn>;
  startEnqueue: ReturnType<typeof vi.fn>;
  finishEnqueue: ReturnType<typeof vi.fn>;
  setOutcome: ReturnType<typeof vi.fn>;
}

function createObservability(): ObservabilitySpies {
  return {
    startRedisClaim: vi.fn(),
    finishRedisClaim: vi.fn(),
    startDuplicateLookup: vi.fn(),
    finishDuplicateLookup: vi.fn(),
    startEnqueue: vi.fn(),
    finishEnqueue: vi.fn(),
    setOutcome: vi.fn(),
  };
}

async function expectApiStatus(promise: Promise<unknown>, status: number): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected API status ${status}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(status);
  }
}

describe('Orders admission remediation with real Redis Operations', () => {
  const claims = new OrderClaimService();
  const redis = new Redis({ ...redisOpsConnectionFromEnv(), lazyConnect: true });

  beforeAll(async () => {
    await Promise.all([claims.onModuleInit(), redis.connect()]);
    await redis.del(testClaimKey);
  });

  afterAll(async () => {
    await redis.del(testClaimKey);
    await Promise.all([claims.onModuleDestroy(), redis.quit()]);
  });

  it('releases only its own Redis claim when enqueue fails and never returns 202', async () => {
    const orders = new OrdersService(
      claims,
      {
        enqueue: vi.fn().mockRejectedValue(new Error('injected queue failure')),
        findJob: vi.fn(),
      } as never,
      createObservability() as never,
    );

    await expectApiStatus(
      orders.admit(testUserId, testProductId, '123e4567-e89b-42d3-a456-426614174000', {}),
      503,
    );
    expect(await redis.get(testClaimKey)).toBeNull();
  });

  it('does not delete a later claim owned by another request', async () => {
    const firstClaim = await claims.acquire(testUserId, testProductId);
    expect(firstClaim.acquired).toBe(true);

    await redis.set(testClaimKey, 'replacement-owner-token', 'EX', 60);
    await claims.releaseIfOwned(testUserId, testProductId, firstClaim.token);

    expect(await redis.get(testClaimKey)).toBe('replacement-owner-token');
    await redis.del(testClaimKey);
  });

  it('returns the deterministic job when it becomes visible during the bounded duplicate check', async () => {
    const findJob = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const orders = new OrdersService(
      { acquire: vi.fn().mockResolvedValue({ acquired: false, token: 'unused' }) } as never,
      { enqueue: vi.fn(), findJob } as never,
      createObservability() as never,
    );

    const response = await orders.admit(
      testUserId,
      testProductId,
      '123e4567-e89b-42d3-a456-426614174000',
      {},
    );

    expect(response).toMatchObject({
      status: 'processing',
      message: 'Your order is in the queue.',
    });
    expect(findJob).toHaveBeenCalledTimes(2);
  });

  it('returns 409 instead of a false 202 when the duplicate job remains invisible', async () => {
    const orders = new OrdersService(
      { acquire: vi.fn().mockResolvedValue({ acquired: false, token: 'unused' }) } as never,
      { enqueue: vi.fn(), findJob: vi.fn().mockResolvedValue(false) } as never,
      createObservability() as never,
    );

    await expectApiStatus(
      orders.admit(testUserId, testProductId, '123e4567-e89b-42d3-a456-426614174000', {}),
      409,
    );
  });
});
