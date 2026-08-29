import { Controller, Get, Header } from '@nestjs/common';
import { ApiMetricsService } from './api-metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: ApiMetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  render(): Promise<string> {
    return this.metrics.render();
  }
}
