import { Global, Module } from '@nestjs/common';
import { WorkerMetricsService } from './worker-metrics.service.js';

@Global()
@Module({ providers: [WorkerMetricsService], exports: [WorkerMetricsService] })
export class WorkerMetricsModule {}
