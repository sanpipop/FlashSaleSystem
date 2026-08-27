import { Module } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { OrdersWorkerModule } from './orders/orders-worker.module.js';
import { OutboxModule } from './outbox/outbox.module.js';

@Module({
  imports: [InfrastructureModule, OrdersWorkerModule, OutboxModule],
})
export class WorkerModule {}
