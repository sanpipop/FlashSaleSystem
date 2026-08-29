import { createServer, type Server } from 'node:http';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { OrderJobResult } from '@flash-sale/contracts';
import { createOrdersQueue, redisOpsConnectionFromEnv, type OrdersQueue } from '@flash-sale/queue';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { writeStructuredLog } from '../logger/structured-log.js';

@Injectable()
export class WorkerMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly registry = new Registry();
  private readonly queue: OrdersQueue = createOrdersQueue(redisOpsConnectionFromEnv());
  private server: Server | undefined;
  private readonly processed = new Counter({
    name: 'flash_sale_worker_jobs_total',
    help: 'Worker jobs by durable business outcome.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly batchDuration = new Histogram({
    name: 'flash_sale_worker_batch_duration_seconds',
    help: 'PostgreSQL micro-batch processing duration.',
    buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });
  private readonly batchSize = new Histogram({
    name: 'flash_sale_worker_batch_size',
    help: 'Number of distinct jobs in each PostgreSQL batch call.',
    buckets: [1, 2, 4, 8, 16, 32],
    registers: [this.registry],
  });
  private readonly queueJobs = new Gauge({
    name: 'flash_sale_worker_queue_jobs',
    help: 'Current BullMQ orders queue depth by state.',
    labelNames: ['state'] as const,
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'worker' });
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'flash_sale_worker_process_',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.queue.waitUntilReady();
    const port = Number(process.env.WORKER_METRICS_PORT ?? 9464);
    this.server = createServer((request, response) => {
      if (request.url !== '/metrics') {
        response.writeHead(404).end('Not Found');
        return;
      }
      void this.render().then(
        (body) => {
          response.writeHead(200, { 'content-type': this.registry.contentType }).end(body);
        },
        () => response.writeHead(500).end('Metrics unavailable'),
      );
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(port, '0.0.0.0', resolve);
    });
    writeStructuredLog('info', {
      event: 'WORKER_METRICS_READY',
      outcome: 'READY',
      port,
    });
  }

  observeBatch(results: readonly OrderJobResult[], durationMs: number): void {
    this.batchDuration.observe(durationMs / 1_000);
    this.batchSize.observe(results.length);
    for (const result of results) {
      this.processed.inc({ outcome: result.status });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.queue.close(),
      new Promise<void>((resolve) => {
        if (!this.server) {
          resolve();
          return;
        }
        this.server.close(() => resolve());
      }),
    ]);
  }

  private async render(): Promise<string> {
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
      // Process and business metrics remain scrapeable if Redis Operations is down.
    }
    return this.registry.metrics();
  }
}
