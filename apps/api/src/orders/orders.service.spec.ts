import { describe, expect, it, vi } from 'vitest';
import { createOrderJobId } from '@flash-sale/queue';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  it('returns the frozen 202 admission response after the job is enqueued', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const orders = new OrdersService(
      {
        acquire: vi.fn().mockResolvedValue({ acquired: true, token: 'claim-token' }),
        releaseIfOwned: vi.fn(),
      } as never,
      { enqueue, findJob: vi.fn() } as never,
    );

    const response = await orders.admit(
      'user-001',
      'p-1001',
      '123e4567-e89b-42d3-a456-426614174000',
    );

    expect(enqueue).toHaveBeenCalledOnce();
    expect(response).toEqual({
      status: 'processing',
      orderJobId: createOrderJobId('user-001', 'p-1001'),
      message: 'Your order is in the queue.',
    });
  });
});
