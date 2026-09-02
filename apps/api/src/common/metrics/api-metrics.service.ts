import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createOrdersQueue, redisOpsConnectionFromEnv, type OrdersQueue } from '@flash-sale/queue';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class ApiMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly registry = new Registry();
  private readonly queue: OrdersQueue = createOrdersQueue(redisOpsConnectionFromEnv());
  private readonly httpRequests = new Counter({
    name: 'flash_sale_http_requests_total',
    help: 'HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: 'flash_sale_http_request_duration_seconds',
    help: 'API request duration in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly cacheRequests = new Counter({
    name: 'flash_sale_product_cache_requests_total',
    help: 'Product cache outcomes.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly cacheFills = new Counter({
    name: 'flash_sale_product_cache_fills_total',
    help: 'Product cache fill coordination outcomes.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly queueJobs = new Gauge({
    name: 'flash_sale_queue_jobs',
    help: 'Current BullMQ orders queue depth by state.',
    labelNames: ['state'] as const,
    registers: [this.registry],
  });
  private readonly orderAdmissionJwtVerifications = new Counter({
    name: 'flash_sale_order_admission_jwt_verifications_total',
    help: 'Order admission JWT verification outcomes.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly orderAdmissionJwtDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_jwt_verify_duration_seconds',
    'Time spent verifying an order admission JWT.',
    ['outcome'] as const,
  );
  private readonly orderAdmissionRedisClaimDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_redis_claim_duration_seconds',
    'Time spent acquiring the Redis order admission claim.',
    ['outcome'] as const,
  );
  private readonly orderAdmissionDuplicateLookupDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_duplicate_lookup_duration_seconds',
    'Time spent resolving a duplicate order admission claim.',
    ['outcome'] as const,
  );
  private readonly orderAdmissionEnqueueDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_enqueue_duration_seconds',
    'Time spent enqueueing an order admission job in BullMQ.',
    ['outcome'] as const,
  );
  private readonly orderAdmissionTotalDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_total_duration_seconds',
    'Application-side duration from order request arrival to controller completion.',
    ['outcome'] as const,
  );
  private readonly orderAdmissionResponseDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_response_duration_seconds',
    'API response lifecycle duration from order request arrival to Fastify onResponse.',
    ['outcome'] as const,
  );
  private readonly orderAdmissionUnaccountedDuration = this.orderAdmissionHistogram(
    'flash_sale_order_admission_unaccounted_duration_seconds',
    'Order admission application time not covered by individually measured stages.',
    ['outcome'] as const,
  );

  constructor() {
    this.registry.setDefaultLabels({
      service: 'api',
      instance: process.env.INSTANCE_ID ?? 'api-local',
    });
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'flash_sale_api_process_',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  observeHttp(method: string, route: string, status: number, durationMs: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationMs / 1_000);
  }

  observeCache(outcome: 'hit' | 'miss' | 'fallback'): void {
    this.cacheRequests.inc({ outcome });
  }

  observeFill(outcome: 'winner' | 'follower' | 'epoch_changed' | 'failed'): void {
    this.cacheFills.inc({ outcome });
  }

  observeOrderAdmissionJwt(
    outcome: 'success' | 'error',
    durationMs: number,
  ): void {
    this.orderAdmissionJwtVerifications.inc({ outcome });
    this.orderAdmissionJwtDuration.observe({ outcome }, durationMs / 1_000);
  }

  recordOrderAdmissionJwtMissing(): void {
    this.orderAdmissionJwtVerifications.inc({ outcome: 'missing' });
  }

  observeOrderAdmissionRedisClaim(
    outcome: 'acquired' | 'already_exists' | 'error',
    durationMs: number,
  ): void {
    this.orderAdmissionRedisClaimDuration.observe({ outcome }, durationMs / 1_000);
  }

  observeOrderAdmissionDuplicateLookup(
    outcome: 'resolved' | 'in_progress' | 'error',
    durationMs: number,
  ): void {
    this.orderAdmissionDuplicateLookupDuration.observe({ outcome }, durationMs / 1_000);
  }

  observeOrderAdmissionEnqueue(outcome: 'success' | 'error', durationMs: number): void {
    this.orderAdmissionEnqueueDuration.observe({ outcome }, durationMs / 1_000);
  }

  observeOrderAdmissionTotal(
    outcome: 'success' | 'duplicate' | 'error',
    durationMs: number,
  ): void {
    this.orderAdmissionTotalDuration.observe({ outcome }, durationMs / 1_000);
  }

  observeOrderAdmissionResponse(
    outcome: 'success' | 'duplicate' | 'error',
    durationMs: number,
  ): void {
    this.orderAdmissionResponseDuration.observe({ outcome }, durationMs / 1_000);
  }

  observeOrderAdmissionUnaccounted(
    outcome: 'success' | 'duplicate' | 'error',
    durationMs: number,
  ): void {
    this.orderAdmissionUnaccountedDuration.observe({ outcome }, durationMs / 1_000);
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  async render(): Promise<string> {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );
      for (const state of ['waiting', 'active', 'completed', 'failed', 'delayed'] as const) {
        this.queueJobs.set({ state }, counts[state] ?? 0);
      }
    } catch {
      // HTTP and cache metrics remain available if the operations Redis is down.
    }
    return this.registry.metrics();
  }

  private orderAdmissionHistogram<const T extends readonly string[]>(
    name: string,
    help: string,
    labelNames: T,
  ): Histogram<T[number]> {
    return new Histogram({
      name,
      help,
      labelNames,
      buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15],
      registers: [this.registry],
    });
  }
}
