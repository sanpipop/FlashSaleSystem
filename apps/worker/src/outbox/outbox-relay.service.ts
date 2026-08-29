import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PRODUCTS_CACHE_EPOCH_KEY, createRedisCacheClient } from '@flash-sale/cache';
import { AppDataSource } from '@flash-sale/database';
import { InfrastructureProbeService } from '../infrastructure/infrastructure-probe.service.js';
import { writeStructuredLog } from '../common/logger/structured-log.js';

interface PendingOutboxRow {
  event_id: string;
}

const RELAY_INTERVAL_MS = 250;
const RELAY_BATCH_SIZE = 100;

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly redis = createRedisCacheClient();
  private timer: NodeJS.Timeout | undefined;
  private flushChain: Promise<number> = Promise.resolve(0);
  private stopped = false;

  constructor(
    @Inject(InfrastructureProbeService)
    private readonly infrastructure: InfrastructureProbeService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.infrastructure.ensureReady();
    await this.ensureRedis().catch((error: unknown) => {
      this.logFailure(error);
    });
    this.timer = setInterval(() => {
      void this.publishPendingNow();
    }, RELAY_INTERVAL_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
    await this.flushChain.catch(() => 0);
    if (this.redis.status !== 'end') {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }

  publishPendingNow(): Promise<number> {
    if (this.stopped) {
      return Promise.resolve(0);
    }
    this.flushChain = this.flushChain
      .catch(() => 0)
      .then(() => this.flushOnce())
      .catch((error: unknown) => {
        this.logFailure(error);
        return 0;
      });
    return this.flushChain;
  }

  private async flushOnce(): Promise<number> {
    const runner = AppDataSource.createQueryRunner();
    let eventIds: string[] = [];
    await runner.connect();
    await runner.startTransaction();

    try {
      const rows = (await runner.query(
        `
          SELECT event_id
          FROM transactional_outbox
          WHERE published_at IS NULL AND next_attempt_at <= CURRENT_TIMESTAMP
          ORDER BY next_attempt_at, created_at
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        `,
        [RELAY_BATCH_SIZE],
      )) as PendingOutboxRow[];
      eventIds = rows.map((row) => row.event_id);
      if (eventIds.length === 0) {
        await runner.commitTransaction();
        return 0;
      }

      await this.ensureRedis();
      await this.redis.incrby(PRODUCTS_CACHE_EPOCH_KEY, eventIds.length);
      await runner.query(
        `
          UPDATE transactional_outbox
          SET published_at = CURRENT_TIMESTAMP, attempts = attempts + 1
          WHERE event_id = ANY($1::uuid[]) AND published_at IS NULL
        `,
        [eventIds],
      );
      await runner.commitTransaction();
      writeStructuredLog('info', {
        event: 'CACHE_EPOCH_INVALIDATED',
        outcome: 'PUBLISHED',
        events: eventIds.length,
      });
      return eventIds.length;
    } catch (error) {
      await runner.rollbackTransaction();
      if (eventIds.length > 0) {
        await AppDataSource.query(
          `
            UPDATE transactional_outbox
            SET attempts = attempts + 1,
                next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '1 second'
            WHERE event_id = ANY($1::uuid[]) AND published_at IS NULL
          `,
          [eventIds],
        ).catch(() => undefined);
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async ensureRedis(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      await this.redis.connect();
    }
    if (this.redis.status !== 'ready') {
      await this.redis.ping();
    }
  }

  private logFailure(error: unknown): void {
    writeStructuredLog('warn', {
      event: 'CACHE_INVALIDATION_RETRY_SCHEDULED',
      outcome: 'RETRY',
      error: error instanceof Error ? error.message : 'unknown invalidation error',
    });
  }
}
