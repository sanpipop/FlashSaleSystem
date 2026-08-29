import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { AppDataSource } from '@flash-sale/database';

@Injectable()
export class InfrastructureProbeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfrastructureProbeService.name);
  private readyPromise: Promise<void> | undefined;

  async onModuleInit(): Promise<void> {
    await this.ensureReady();
  }

  ensureReady(): Promise<void> {
    this.readyPromise ??= this.connectDatabase();
    return this.readyPromise;
  }

  private async connectDatabase(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    this.logger.log(
      'Worker connected to PostgreSQL; BullMQ manages its Redis Operations connection.',
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}
