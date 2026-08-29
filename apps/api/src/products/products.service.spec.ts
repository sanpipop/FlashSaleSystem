import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';

describe('ProductsService product lookup single-flight', () => {
  it('shares one database query only while identical lookups are in flight', async () => {
    const product = { productId: 'p-1001', isFlashSaleActive: true };
    const findOneBy = vi.fn().mockResolvedValue(product);
    const service = new ProductsService(
      {
        dataSource: {
          getRepository: () => ({ findOneBy }),
        },
      } as never,
      {} as never,
    );

    const results = await Promise.all(
      Array.from({ length: 100 }, () => service.findById('p-1001')),
    );

    expect(results).toEqual(Array.from({ length: 100 }, () => product));
    expect(findOneBy).toHaveBeenCalledTimes(1);

    await service.findById('p-1001');
    expect(findOneBy).toHaveBeenCalledTimes(2);
  });
});
