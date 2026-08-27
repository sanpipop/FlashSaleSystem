import { Module } from '@nestjs/common';
import { OrderBatchCoordinatorService } from './order-batch-coordinator.service.js';
import { OrderBatchProcessorService } from './order-batch-processor.service.js';
import { OrdersWorkerConsumer } from './orders-worker.consumer.js';

@Module({
  providers: [
    OrderBatchProcessorService,
    OrderBatchCoordinatorService,
    OrdersWorkerConsumer,
  ],
})
export class OrdersWorkerModule {}
