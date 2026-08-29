import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppDataSource } from '@flash-sale/database';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }

  get dataSource(): typeof AppDataSource {
    return AppDataSource;
  }
}
