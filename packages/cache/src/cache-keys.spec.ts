import { describe, expect, it } from 'vitest';
import {
  orderClaimKey,
  productPageCacheKey,
  productPageFillKey,
  PRODUCTS_CACHE_EPOCH_KEY,
} from './cache-keys.js';

describe('Redis contract key builders', () => {
  it('builds the frozen products cache namespace', () => {
    expect(PRODUCTS_CACHE_EPOCH_KEY).toBe('fs:cache:products:epoch');
    expect(productPageCacheKey(15, 1, 10)).toBe(
      'fs:cache:products:v=15:page=1:limit=10',
    );
    expect(productPageFillKey(15, 1, 10)).toBe(
      'fs:cache:fill:v=15:page=1:limit=10',
    );
  });

  it('scopes duplicate claims by user and product', () => {
    expect(orderClaimKey('user-999', 'p-1001')).toBe(
      'fs:claim:order:user-999:p-1001',
    );
  });
});
