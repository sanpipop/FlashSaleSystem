import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  instanceId: string;
}

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      instanceId: process.env.INSTANCE_ID ?? 'api-local',
    };
  }
}
