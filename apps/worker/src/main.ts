import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';
import { writeStructuredLog } from './common/logger/structured-log.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
  });

  app.enableShutdownHooks();
  writeStructuredLog('info', { event: 'WORKER_READY', outcome: 'READY' });
}

void bootstrap();
