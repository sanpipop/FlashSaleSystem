import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppDataSource } from '@flash-sale/database';

@Injectable()
export class InfrastructureProbeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfrastructureProbeService.name);
  async onModuleInit(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    this.logger.log('Worker connected to PostgreSQL and BullMQ initialization is managed by the order consumer.');
  }

  async onModuleDestroy(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}
