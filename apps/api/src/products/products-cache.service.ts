import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ProductsResponse } from '@flash-sale/contracts';
import {
  createRedisCacheClient,
  VersionedProductsCache,
  type FillClaim,
} from '@flash-sale/cache';
import { ApiMetricsService } from '../common/metrics/api-metrics.service.js';
import { writeStructuredLog } from '../common/logger/structured-log.js';
import type { ProductsQueryDto } from './products.dto.js';

const FOLLOWER_ATTEMPTS = 5;
const FOLLOWER_WAIT_MS = 2;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

@Injectable()
export class ProductsCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly redis = createRedisCacheClient();
  private readonly cache = new VersionedProductsCache(this.redis);

  constructor(private readonly metrics: ApiMetricsService) {}

  async onModuleInit(): Promise<void> {
    await this.cache.connect().catch((error: unknown) => {
      writeStructuredLog('warn', {
        event: 'PRODUCT_CACHE_CONNECT_FAILED',
        outcome: 'DB_FALLBACK',
        error: error instanceof Error ? error.message : 'unknown cache error',
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cache.close();
  }

  async getOrLoad(
    query: ProductsQueryDto,
    loadFromDatabase: () => Promise<ProductsResponse>,
  ): Promise<ProductsResponse> {
    let initial;
    try {
      initial = await this.cache.read(query.page, query.limit);
      if (initial.value !== null) {
        const cached = this.parse(initial.value);
        if (cached !== null) {
          this.metrics.observeCache('hit');
          return cached;
        }
      }
      this.metrics.observeCache('miss');
    } catch (error) {
      return this.fallback(loadFromDatabase, error);
    }

    let claim: FillClaim;
    try {
      claim = await this.cache.acquireFill(initial.epoch, query.page, query.limit);
    } catch (error) {
      return this.fallback(loadFromDatabase, error);
    }

    if (!claim.acquired) {
      this.metrics.observeFill('follower');
      for (let attempt = 0; attempt < FOLLOWER_ATTEMPTS; attempt += 1) {
        await delay(FOLLOWER_WAIT_MS);
        try {
          const followerRead = await this.cache.read(query.page, query.limit);
          const cached = followerRead.value === null ? null : this.parse(followerRead.value);
          if (cached !== null) {
            this.metrics.observeCache('hit');
            return cached;
          }
          if (followerRead.epoch !== initial.epoch) {
            break;
          }
        } catch (error) {
          return this.fallback(loadFromDatabase, error);
        }
      }
      return this.fallback(loadFromDatabase, new Error('Cache fill wait expired.'));
    }

    this.metrics.observeFill('winner');
    try {
      const response = await loadFromDatabase();
      const written = await this.cache.writeIfCurrent(
        initial.epoch,
        query.page,
        query.limit,
        JSON.stringify(response),
        55 + Math.floor(Math.random() * 11),
      );
      if (!written) {
        this.metrics.observeFill('epoch_changed');
      }
      return response;
    } catch (error) {
      this.metrics.observeFill('failed');
      throw error;
    } finally {
      await this.cache.releaseFill(claim).catch(() => undefined);
    }
  }

  private parse(value: string): ProductsResponse | null {
    try {
      return JSON.parse(value) as ProductsResponse;
    } catch {
      return null;
    }
  }

  private async fallback(
    loadFromDatabase: () => Promise<ProductsResponse>,
    error: unknown,
  ): Promise<ProductsResponse> {
    this.metrics.observeCache('fallback');
    writeStructuredLog('warn', {
      event: 'PRODUCT_CACHE_FALLBACK',
      outcome: 'DB_FALLBACK',
      error: error instanceof Error ? error.message : 'unknown cache error',
    });
    return loadFromDatabase();
  }
}
