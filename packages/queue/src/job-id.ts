import { createHash } from 'node:crypto';

export function createOrderJobId(userId: string, productId: string): string {
  const canonicalInput = `${userId}|${productId}`;
  const digest = createHash('sha256').update(canonicalInput, 'utf8').digest('hex');

  return `ord-${digest}`;
}
