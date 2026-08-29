import { afterEach, describe, expect, it } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const originalInstanceId = process.env.INSTANCE_ID;

  afterEach(() => {
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
  });

  it('exposes the stateless instance identity', () => {
    process.env.INSTANCE_ID = 'api-2';

    expect(new HealthService().getHealth()).toEqual({
      status: 'ok',
      instanceId: 'api-2',
    });
  });
});
