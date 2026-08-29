import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import {
  PRODUCTS_CACHE_EPOCH_KEY,
  productPageCacheKey,
  productPageFillKey,
} from './cache-keys.js';

const READ_SCRIPT = `
local epoch = redis.call('GET', KEYS[1]) or '0'
local cacheKey = 'fs:cache:products:v=' .. epoch .. ':page=' .. ARGV[1] .. ':limit=' .. ARGV[2]
return { epoch, redis.call('GET', cacheKey) }
`;

const WRITE_IF_CURRENT_SCRIPT = `
local currentEpoch = redis.call('GET', KEYS[1]) or '0'
if currentEpoch ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

const COMPARE_AND_DELETE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export interface VersionedCacheRead {
  epoch: number;
  value: string | null;
}

export interface FillClaim {
  key: string;
  token: string;
  acquired: boolean;
}

function isNoScript(error: unknown): boolean {
  return error instanceof Error && error.message.includes('NOSCRIPT');
}

function positiveEpoch(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export class VersionedProductsCache {
  private readSha: string | undefined;
  private writeSha: string | undefined;
  private releaseSha: string | undefined;

  constructor(private readonly redis: Redis) {}

  async connect(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      await this.redis.connect();
    }
    await this.loadScripts();
  }

  async read(page: number, limit: number): Promise<VersionedCacheRead> {
    await this.ensureScripts();

    try {
      return this.parseRead(
        await this.redis.evalsha(
          this.readSha as string,
          1,
          PRODUCTS_CACHE_EPOCH_KEY,
          page,
          limit,
        ),
      );
    } catch (error) {
      if (!isNoScript(error)) {
        throw error;
      }
      this.readSha = await this.loadScript(READ_SCRIPT);
      return this.parseRead(
        await this.redis.evalsha(
          this.readSha,
          1,
          PRODUCTS_CACHE_EPOCH_KEY,
          page,
          limit,
        ),
      );
    }
  }

  async acquireFill(epoch: number, page: number, limit: number): Promise<FillClaim> {
    const key = productPageFillKey(epoch, page, limit);
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', 1_000, 'NX');
    return { key, token, acquired: result === 'OK' };
  }

  async releaseFill(claim: FillClaim): Promise<void> {
    if (!claim.acquired) {
      return;
    }
    await this.ensureScripts();

    try {
      await this.redis.evalsha(this.releaseSha as string, 1, claim.key, claim.token);
    } catch (error) {
      if (!isNoScript(error)) {
        throw error;
      }
      this.releaseSha = await this.loadScript(COMPARE_AND_DELETE_SCRIPT);
      await this.redis.evalsha(this.releaseSha, 1, claim.key, claim.token);
    }
  }

  async writeIfCurrent(
    epoch: number,
    page: number,
    limit: number,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    await this.ensureScripts();
    const key = productPageCacheKey(epoch, page, limit);

    try {
      return (
        (await this.redis.evalsha(
          this.writeSha as string,
          2,
          PRODUCTS_CACHE_EPOCH_KEY,
          key,
          epoch,
          value,
          ttlSeconds,
        )) === 1
      );
    } catch (error) {
      if (!isNoScript(error)) {
        throw error;
      }
      this.writeSha = await this.loadScript(WRITE_IF_CURRENT_SCRIPT);
      return (
        (await this.redis.evalsha(
          this.writeSha,
          2,
          PRODUCTS_CACHE_EPOCH_KEY,
          key,
          epoch,
          value,
          ttlSeconds,
        )) === 1
      );
    }
  }

  async close(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }

  private async ensureScripts(): Promise<void> {
    if (this.redis.status !== 'ready') {
      await this.connect();
    } else if (!this.readSha || !this.writeSha || !this.releaseSha) {
      await this.loadScripts();
    }
  }

  private async loadScripts(): Promise<void> {
    [this.readSha, this.writeSha, this.releaseSha] = await Promise.all([
      this.loadScript(READ_SCRIPT),
      this.loadScript(WRITE_IF_CURRENT_SCRIPT),
      this.loadScript(COMPARE_AND_DELETE_SCRIPT),
    ]);
  }

  private async loadScript(script: string): Promise<string> {
    return (await this.redis.script('LOAD', script)) as string;
  }

  private parseRead(raw: unknown): VersionedCacheRead {
    if (!Array.isArray(raw) || raw.length < 1) {
      throw new Error('Redis cache read script returned an invalid response.');
    }
    const values = raw as unknown[];
    const value = values[1];
    return {
      epoch: positiveEpoch(values[0]),
      value: typeof value === 'string' ? value : null,
    };
  }
}
