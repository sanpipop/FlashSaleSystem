import { Global, Module } from '@nestjs/common';
import { ApiMetricsService } from './api-metrics.service.js';
import { MetricsController } from './metrics.controller.js';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [ApiMetricsService],
  exports: [ApiMetricsService],
})
export class MetricsModule {}
