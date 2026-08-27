import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { ORDER_QUEUE_NAME, PROCESS_ORDER_JOB_NAME, type OrderJobPayload, type OrderJobResult } from '@flash-sale/contracts';
import { redisOpsConnectionFromEnv } from '@flash-sale/queue';
import { OrderBatchCoordinatorService } from './order-batch-coordinator.service.js';

@Injectable()
export class OrdersWorkerConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersWorkerConsumer.name);
  private worker?: Worker<OrderJobPayload, OrderJobResult>;

  constructor(private readonly coordinator: OrderBatchCoordinatorService) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<OrderJobPayload, OrderJobResult>(
      ORDER_QUEUE_NAME,
      async (job: Job<OrderJobPayload, OrderJobResult>) => {
        if (job.name !== PROCESS_ORDER_JOB_NAME) {
          throw new Error(`Unsupported order job name: ${job.name}`);
        }
        return this.coordinator.submit(job.data);
      },
      {
        connection: redisOpsConnectionFromEnv(),
        concurrency: this.workerConcurrency(),
      },
    );
    this.worker.on('error', (error) => this.logger.error(error.message));
    await this.worker.waitUntilReady();
    this.logger.log(`Consuming ${ORDER_QUEUE_NAME}/${PROCESS_ORDER_JOB_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.coordinator.close();
  }

  private workerConcurrency(): number {
    const value = Number(process.env.WORKER_CONCURRENCY ?? 8);
    return Number.isInteger(value) && value > 0 ? value : 8;
  }
}
