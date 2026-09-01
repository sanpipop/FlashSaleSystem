import { Global, Module } from '@nestjs/common';
import { ApiMetricsService } from './api-metrics.service.js';
import { MetricsController } from './metrics.controller.js';
import { OrderAdmissionObservabilityService } from './order-admission-observability.service.js';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [ApiMetricsService, OrderAdmissionObservabilityService],
  exports: [ApiMetricsService, OrderAdmissionObservabilityService],
})
export class MetricsModule {}
