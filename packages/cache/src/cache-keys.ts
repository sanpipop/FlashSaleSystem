export const PRODUCTS_CACHE_EPOCH_KEY = 'fs:cache:products:epoch' as const;

export function productPageCacheKey(epoch: number, page: number, limit: number): string {
  return `fs:cache:products:v=${epoch}:page=${page}:limit=${limit}`;
}

export function productPageFillKey(epoch: number, page: number, limit: number): string {
  return `fs:cache:fill:v=${epoch}:page=${page}:limit=${limit}`;
}

export function orderClaimKey(userId: string, productId: string): string {
  return `fs:claim:order:${userId}:${productId}`;
}
