import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { OrderJobPayload } from '@flash-sale/contracts';
import { createOrdersQueue, enqueueOrderJob, redisOpsConnectionFromEnv, type OrdersQueue } from '@flash-sale/queue';

@Injectable()
export class OrderQueueProducer implements OnModuleInit, OnModuleDestroy {
  private queue?: OrdersQueue;

  async onModuleInit(): Promise<void> {
    this.queue = createOrdersQueue(redisOpsConnectionFromEnv());
    await this.queue.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  async enqueue(payload: OrderJobPayload): Promise<string> {
    if (!this.queue) {
      throw new Error('Order queue is not initialized');
    }
    return enqueueOrderJob(this.queue, payload);
  }

  async findJob(jobId: string): Promise<boolean> {
    if (!this.queue) {
      throw new Error('Order queue is not initialized');
    }
    return (await this.queue.getJob(jobId)) !== undefined;
  }
}
