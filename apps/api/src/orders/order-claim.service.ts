import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { orderClaimKey } from '@flash-sale/cache';
import { redisOpsConnectionFromEnv } from '@flash-sale/queue';

export interface OrderClaim {
  acquired: boolean;
  token: string;
}

@Injectable()
export class OrderClaimService implements OnModuleInit, OnModuleDestroy {
  private readonly redis = new Redis({ ...redisOpsConnectionFromEnv(), lazyConnect: true });

  async onModuleInit(): Promise<void> {
    await this.redis.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async acquire(userId: string, productId: string): Promise<OrderClaim> {
    const token = randomUUID();
    const result = await this.redis.set(orderClaimKey(userId, productId), token, 'EX', 60, 'NX');
    return { acquired: result === 'OK', token };
  }

  async releaseIfOwned(userId: string, productId: string, token: string): Promise<void> {
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      orderClaimKey(userId, productId),
      token,
    );
  }
}
