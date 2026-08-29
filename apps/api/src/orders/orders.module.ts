import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrderClaimService } from './order-claim.service.js';
import { OrderQueueProducer } from './order-queue.producer.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController],
  providers: [OrderClaimService, OrderQueueProducer, OrdersService],
})
export class OrdersModule {}
