import { afterEach, describe, expect, it, vi } from 'vitest';

const structuredLog = vi.hoisted(() => vi.fn());

vi.mock('../logger/structured-log.js', () => ({ writeStructuredLog: structuredLog }));

import { OrderAdmissionObservabilityService } from './order-admission-observability.service.js';

interface MetricsSpies {
  observeOrderAdmissionJwt: ReturnType<typeof vi.fn>;
  recordOrderAdmissionJwtMissing: ReturnType<typeof vi.fn>;
  observeOrderAdmissionRedisClaim: ReturnType<typeof vi.fn>;
  observeOrderAdmissionDuplicateLookup: ReturnType<typeof vi.fn>;
  observeOrderAdmissionEnqueue: ReturnType<typeof vi.fn>;
  observeOrderAdmissionTotal: ReturnType<typeof vi.fn>;
  observeOrderAdmissionResponse: ReturnType<typeof vi.fn>;
  observeOrderAdmissionUnaccounted: ReturnType<typeof vi.fn>;
}

function createMetrics(): MetricsSpies {
  return {
    observeOrderAdmissionJwt: vi.fn(),
    recordOrderAdmissionJwtMissing: vi.fn(),
    observeOrderAdmissionRedisClaim: vi.fn(),
    observeOrderAdmissionDuplicateLookup: vi.fn(),
    observeOrderAdmissionEnqueue: vi.fn(),
    observeOrderAdmissionTotal: vi.fn(),
    observeOrderAdmissionResponse: vi.fn(),
    observeOrderAdmissionUnaccounted: vi.fn(),
  };
}

afterEach(() => {
  structuredLog.mockReset();
  vi.unstubAllEnvs();
});

describe('OrderAdmissionObservabilityService', () => {
  it('records unique admission stage observations with low-cardinality outcomes only', () => {
    const metrics = createMetrics();
    const observability = new OrderAdmissionObservabilityService(metrics as never);
    const request = {};

    observability.begin(request);
    observability.finishJwtVerification(request, observability.startJwtVerification(request), 'success');
    observability.finishRedisClaim(request, observability.startRedisClaim(request), 'acquired');
    observability.finishEnqueue(request, observability.startEnqueue(request), 'success');
    observability.setOutcome(request, 'success');
    observability.completeAdmission(request, 'error');
    observability.completeResponse(request, 202, '123e4567-e89b-42d3-a456-426614174000');

    expect(metrics.observeOrderAdmissionJwt).toHaveBeenCalledWith('success', expect.any(Number));
    expect(metrics.observeOrderAdmissionRedisClaim).toHaveBeenCalledWith('acquired', expect.any(Number));
    expect(metrics.observeOrderAdmissionEnqueue).toHaveBeenCalledWith('success', expect.any(Number));
    expect(metrics.observeOrderAdmissionTotal).toHaveBeenCalledWith('success', expect.any(Number));
    expect(metrics.observeOrderAdmissionResponse).toHaveBeenCalledWith('success', expect.any(Number));
    expect(metrics.observeOrderAdmissionUnaccounted).toHaveBeenCalledWith('success', expect.any(Number));
    expect(JSON.stringify(metrics.observeOrderAdmissionTotal.mock.calls)).not.toContain(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('records the complete duplicate resolution stage and preserves an error outcome', () => {
    const metrics = createMetrics();
    const observability = new OrderAdmissionObservabilityService(metrics as never);
    const request = {};

    observability.begin(request);
    observability.finishRedisClaim(request, observability.startRedisClaim(request), 'already_exists');
    observability.finishDuplicateLookup(
      request,
      observability.startDuplicateLookup(request),
      'in_progress',
    );
    observability.setOutcome(request, 'duplicate');
    observability.completeAdmission(request, 'error');
    observability.completeResponse(request, 409, '123e4567-e89b-42d3-a456-426614174000');

    expect(metrics.observeOrderAdmissionDuplicateLookup).toHaveBeenCalledWith(
      'in_progress',
      expect.any(Number),
    );
    expect(metrics.observeOrderAdmissionTotal).toHaveBeenCalledWith('duplicate', expect.any(Number));
  });

  it('emits one sanitized slow log only when the configured threshold is crossed', () => {
    vi.stubEnv('ORDER_ADMISSION_SLOW_LOG_MS', '60000');
    const fastMetrics = createMetrics();
    const fast = new OrderAdmissionObservabilityService(fastMetrics as never);
    const fastRequest = {};
    fast.begin(fastRequest);
    fast.setOutcome(fastRequest, 'success');
    fast.completeAdmission(fastRequest, 'error');
    fast.completeResponse(fastRequest, 202, '123e4567-e89b-42d3-a456-426614174000');
    expect(structuredLog).not.toHaveBeenCalled();

    vi.stubEnv('ORDER_ADMISSION_SLOW_LOG_MS', '0');
    const slowMetrics = createMetrics();
    const slow = new OrderAdmissionObservabilityService(slowMetrics as never);
    const slowRequest = {};
    slow.begin(slowRequest);
    slow.setOutcome(slowRequest, 'success');
    slow.completeAdmission(slowRequest, 'error');
    slow.completeResponse(slowRequest, 202, '123e4567-e89b-42d3-a456-426614174000');

    expect(structuredLog).toHaveBeenCalledOnce();
    const entry = structuredLog.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(entry).toMatchObject({
      event: 'ORDER_ADMISSION_SLOW',
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      path: 'unique',
      outcomeStatus: 202,
    });
    expect(entry).not.toHaveProperty('authorization');
    expect(entry).not.toHaveProperty('token');
    expect(entry).not.toHaveProperty('accessToken');
  });
});
