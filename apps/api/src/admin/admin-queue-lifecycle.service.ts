import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { adminOrdersQueue } from './admin-queue.js';

@Injectable()
export class AdminQueueLifecycleService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await adminOrdersQueue.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await adminOrdersQueue.close();
  }
}
