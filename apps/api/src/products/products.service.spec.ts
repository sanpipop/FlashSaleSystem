import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';

describe('ProductsService product lookup and micro-cache', () => {
  it('shares one database query while identical lookups are in flight (Single-Flight)', async () => {
    const product = { productId: 'p-1001', isFlashSaleActive: true };
    const findOneBy = vi.fn().mockResolvedValue(product);
    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    const results = await Promise.all(
      Array.from({ length: 100 }, () => service.findById('p-1001')),
    );

    expect(results).toEqual(Array.from({ length: 100 }, () => product));
    expect(findOneBy).toHaveBeenCalledTimes(1);
  });

  it('serves subsequent lookups from memory cache within TTL without querying DB', async () => {
    const product = { productId: 'p-1001', isFlashSaleActive: true };
    const findOneBy = vi.fn().mockResolvedValue(product);
    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    await service.findById('p-1001', 5_000);
    expect(findOneBy).toHaveBeenCalledTimes(1);

    const cached = await service.findById('p-1001', 5_000);
    expect(cached).toEqual(product);
    expect(findOneBy).toHaveBeenCalledTimes(1);
  });

  it('bypasses memory cache and hits DB directly when ttlMs is 0', async () => {
    const product = { productId: 'p-1001', isFlashSaleActive: true };
    const findOneBy = vi.fn().mockResolvedValue(product);
    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    await service.findById('p-1001', 5_000);
    expect(findOneBy).toHaveBeenCalledTimes(1);

    await service.findById('p-1001', 0);
    expect(findOneBy).toHaveBeenCalledTimes(2);
  });

  it('caches negative lookups (null) and avoids DB stampede for non-existent products', async () => {
    const findOneBy = vi.fn().mockResolvedValue(null);
    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    const first = await service.findById('p-nonexistent', 5_000);
    expect(first).toBeNull();
    expect(findOneBy).toHaveBeenCalledTimes(1);

    const second = await service.findById('p-nonexistent', 5_000);
    expect(second).toBeNull();
    expect(findOneBy).toHaveBeenCalledTimes(1);
  });

  it('cleans up in-flight promise and does not cache bad value if DB query throws', async () => {
    const findOneBy = vi
      .fn()
      .mockRejectedValueOnce(new Error('DB connection timeout'))
      .mockResolvedValueOnce({ productId: 'p-1001', isFlashSaleActive: true });

    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    await expect(service.findById('p-1001')).rejects.toThrow('DB connection timeout');
    expect(findOneBy).toHaveBeenCalledTimes(1);

    // Next lookup must be able to retry
    const product = await service.findById('p-1001');
    expect(product).toEqual({ productId: 'p-1001', isFlashSaleActive: true });
    expect(findOneBy).toHaveBeenCalledTimes(2);
  });

  it('enforces bounded cache size <= 128 under massive distinct keys insertion (Memory Safety)', async () => {
    const findOneBy = vi.fn().mockImplementation((criteria: { productId: string }) =>
      Promise.resolve({ productId: criteria.productId, isFlashSaleActive: true }),
    );
    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    // Insert 200 distinct keys into cache
    for (let i = 1; i <= 200; i++) {
      await service.findById(`p-${i}`, 5_000);
    }

    const internalMap = (service as unknown as { memoryCache: Map<string, unknown> }).memoryCache;
    expect(internalMap.size).toBeLessThanOrEqual(128);
    expect(findOneBy).toHaveBeenCalledTimes(200);

    // The most recently inserted items must be present in cache
    await service.findById('p-200', 5_000);
    expect(findOneBy).toHaveBeenCalledTimes(200); // Hit cache!
  });

  it('removes expired entries on lookup and re-queries database', async () => {
    const findOneBy = vi.fn().mockResolvedValue({ productId: 'p-1001', isFlashSaleActive: true });
    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    // Insert with very short TTL (1ms)
    await service.findById('p-1001', 1);
    expect(findOneBy).toHaveBeenCalledTimes(1);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 15));

    await service.findById('p-1001', 5_000);
    expect(findOneBy).toHaveBeenCalledTimes(2);
  });

  it('handles multiple independent product keys independently', async () => {
    const p1 = { productId: 'p-1001', isFlashSaleActive: true };
    const p2 = { productId: 'p-1002', isFlashSaleActive: false };
    const findOneBy = vi.fn().mockImplementation((criteria: { productId: string }) => {
      if (criteria.productId === 'p-1001') return Promise.resolve(p1);
      if (criteria.productId === 'p-1002') return Promise.resolve(p2);
      return Promise.resolve(null);
    });

    const service = new ProductsService(
      { dataSource: { getRepository: () => ({ findOneBy }) } } as never,
      {} as never,
    );

    const res1 = await service.findById('p-1001');
    const res2 = await service.findById('p-1002');

    expect(res1).toEqual(p1);
    expect(res2).toEqual(p2);
    expect(findOneBy).toHaveBeenCalledTimes(2);

    // Both should now be cached
    expect(await service.findById('p-1001')).toEqual(p1);
    expect(await service.findById('p-1002')).toEqual(p2);
    expect(findOneBy).toHaveBeenCalledTimes(2);
  });
});
