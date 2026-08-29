import {
  Injectable,
  Inject,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ORDER_QUEUE_NAME,
  PROCESS_ORDER_JOB_NAME,
  type OrderJobPayload,
  type OrderJobResult,
} from '@flash-sale/contracts';
import { redisOpsConnectionFromEnv } from '@flash-sale/queue';
import { Worker } from 'bullmq';
import { InfrastructureProbeService } from '../infrastructure/infrastructure-probe.service.js';
import { MicroBatchCoordinatorService } from './micro-batch-coordinator.service.js';
import { workerSettingsFromEnv } from './worker-settings.js';

@Injectable()
export class OrderQueueConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderQueueConsumerService.name);
  private readonly settings = workerSettingsFromEnv();
  private worker: Worker<OrderJobPayload, OrderJobResult> | undefined;

  constructor(
    @Inject(InfrastructureProbeService)
    private readonly infrastructure: InfrastructureProbeService,
    @Inject(MicroBatchCoordinatorService)
    private readonly coordinator: MicroBatchCoordinatorService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.infrastructure.ensureReady();

    this.worker = new Worker<OrderJobPayload, OrderJobResult>(
      ORDER_QUEUE_NAME,
      async (job) => {
        if (job.name !== PROCESS_ORDER_JOB_NAME) {
          throw new Error(`Unsupported order job name: ${job.name}`);
        }

        if (job.id !== job.data.jobId) {
          throw new Error(`BullMQ job ID does not match payload jobId: ${job.id}`);
        }

        return this.coordinator.add(job);
      },
      {
        connection: redisOpsConnectionFromEnv(),
        concurrency: this.settings.concurrency,
      },
    );

    this.worker.on('error', (error) => {
      this.logger.error(`BullMQ worker error: ${error.message}`, error.stack);
    });

    await this.worker.waitUntilReady();
    this.logger.log(
      `Consuming ${ORDER_QUEUE_NAME} with concurrency=${this.settings.concurrency}, ` +
        `batchSize=${this.settings.batchSize}, batchWaitMs=${this.settings.batchWaitMs}.`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
