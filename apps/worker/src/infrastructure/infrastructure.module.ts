import { Module } from '@nestjs/common';
import { InfrastructureProbeService } from './infrastructure-probe.service.js';

@Module({
  providers: [InfrastructureProbeService],
  exports: [InfrastructureProbeService],
})
export class InfrastructureModule {}
