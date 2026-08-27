import { randomUUID } from 'node:crypto';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canonicalRequestId(value: unknown): string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value)
    ? value
    : randomUUID();
}

export function isUuidV4(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}
