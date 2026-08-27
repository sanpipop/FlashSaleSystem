import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';
import { MicroBatchCoordinatorService } from './micro-batch-coordinator.service.js';
import { OrderBatchProcessorService } from './order-batch-processor.service.js';
import { OrderQueueConsumerService } from './order-queue-consumer.service.js';

@Module({
  imports: [InfrastructureModule, OutboxModule],
  providers: [
    OrderBatchProcessorService,
    MicroBatchCoordinatorService,
    OrderQueueConsumerService,
  ],
})
export class OrdersWorkerModule {}
