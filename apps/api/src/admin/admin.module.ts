import { Module } from '@nestjs/common';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { BullBoardModule } from '@bull-board/nestjs';
import { AdminQueueLifecycleService } from './admin-queue-lifecycle.service.js';
import { adminOrdersQueue } from './admin-queue.js';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: FastifyAdapter,
    }),
    BullBoardModule.forFeature({
      queue: adminOrdersQueue,
      adapter: BullMQAdapter,
      options: {
        readOnlyMode: true,
        description: 'Flash Sale orders queue',
      },
    }),
  ],
  providers: [AdminQueueLifecycleService],
})
export class AdminModule {}
