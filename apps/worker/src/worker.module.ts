import { Module } from '@nestjs/common';
import { InfrastructureProbeService } from './infrastructure/infrastructure-probe.service.js';
import { OrdersWorkerModule } from './orders/orders-worker.module.js';
import { OutboxModule } from './outbox/outbox.module.js';

@Module({
  imports: [OrdersWorkerModule, OutboxModule],
  providers: [InfrastructureProbeService],
})
export class WorkerModule {}
