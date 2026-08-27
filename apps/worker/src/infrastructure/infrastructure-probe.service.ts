import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createRedisCacheClient } from '@flash-sale/cache';
import { AppDataSource } from '@flash-sale/database';
import { redisOpsConnectionFromEnv } from '@flash-sale/queue';
import Redis from 'ioredis';

@Injectable()
export class InfrastructureProbeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfrastructureProbeService.name);
  private readonly redisOps = new Redis({
    ...redisOpsConnectionFromEnv(),
    lazyConnect: true,
  });
  private readonly redisCache = createRedisCacheClient();

  async onModuleInit(): Promise<void> {
    await Promise.all([
      AppDataSource.initialize(),
      this.redisOps.connect(),
      this.redisCache.connect(),
    ]);
    await Promise.all([this.redisOps.ping(), this.redisCache.ping()]);

    this.logger.log('Worker scaffold connected to PostgreSQL, Redis Ops, and Redis Cache.');
    this.logger.warn('Order consumption remains disabled until Day 2 transaction logic is implemented.');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.redisOps.quit(), this.redisCache.quit()]);

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}
