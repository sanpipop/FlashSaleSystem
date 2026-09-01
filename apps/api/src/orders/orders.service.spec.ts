import { describe, expect, it, vi } from 'vitest';
import { createOrderJobId } from '@flash-sale/queue';
import { ApiException } from '../common/api-exception.js';
import { OrdersService } from './orders.service.js';

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

describe('OrdersService', () => {
  it('returns the frozen 202 admission response after the job is enqueued', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const observability = createObservability();
    const request = {};
    const orders = new OrdersService(
      {
        acquire: vi.fn().mockResolvedValue({ acquired: true, token: 'claim-token' }),
        releaseIfOwned: vi.fn(),
      } as never,
      { enqueue, findJob: vi.fn() } as never,
      observability as never,
    );

    const response = await orders.admit(
      'user-001',
      'p-1001',
      '123e4567-e89b-42d3-a456-426614174000',
      request,
    );

    expect(enqueue).toHaveBeenCalledOnce();
    expect(response).toEqual({
      status: 'processing',
      orderJobId: createOrderJobId('user-001', 'p-1001'),
      message: 'Your order is in the queue.',
    });
    expect(observability.startRedisClaim).toHaveBeenCalledWith(request);
    expect(observability.finishRedisClaim).toHaveBeenCalledWith(
      request,
      undefined,
      'acquired',
    );
    expect(observability.startEnqueue).toHaveBeenCalledWith(request);
    expect(observability.finishEnqueue).toHaveBeenCalledWith(request, undefined, 'success');
  });

  it('records the complete duplicate lookup stage without changing the idempotent response', async () => {
    const observability = createObservability();
    const request = {};
    const orders = new OrdersService(
      { acquire: vi.fn().mockResolvedValue({ acquired: false, token: 'unused' }) } as never,
      { enqueue: vi.fn(), findJob: vi.fn().mockResolvedValue(true) } as never,
      observability as never,
    );

    await expect(
      orders.admit('user-001', 'p-1001', '123e4567-e89b-42d3-a456-426614174000', request),
    ).resolves.toMatchObject({ status: 'processing' });

    expect(observability.startDuplicateLookup).toHaveBeenCalledWith(request);
    expect(observability.finishDuplicateLookup).toHaveBeenCalledWith(
      request,
      undefined,
      'resolved',
    );
    expect(observability.setOutcome).toHaveBeenCalledWith(request, 'duplicate');
  });

  it('records enqueue failure timing while preserving the frozen 503 response', async () => {
    const observability = createObservability();
    const request = {};
    const releaseIfOwned = vi.fn().mockResolvedValue(undefined);
    const orders = new OrdersService(
      {
        acquire: vi.fn().mockResolvedValue({ acquired: true, token: 'claim-token' }),
        releaseIfOwned,
      } as never,
      { enqueue: vi.fn().mockRejectedValue(new Error('queue unavailable')), findJob: vi.fn() } as never,
      observability as never,
    );

    await expect(
      orders.admit('user-001', 'p-1001', '123e4567-e89b-42d3-a456-426614174000', request),
    ).rejects.toBeInstanceOf(ApiException);

    expect(releaseIfOwned).toHaveBeenCalledOnce();
    expect(observability.finishEnqueue).toHaveBeenCalledWith(request, undefined, 'error');
    expect(observability.setOutcome).toHaveBeenCalledWith(request, 'error');
  });
});
