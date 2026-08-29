import { performance } from 'node:perf_hooks';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { canonicalRequestId } from './common/request-id.js';
import { writeStructuredLog } from './common/logger/structured-log.js';
import { ApiMetricsService } from './common/metrics/api-metrics.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { logger: false },
  );
  const server = app.getHttpAdapter().getInstance();
  const metrics = app.get(ApiMetricsService);
  const requestStarts = new WeakMap<object, number>();
  const successLogSampleRate = Math.min(
    1,
    Math.max(0, Number(process.env.HTTP_SUCCESS_LOG_SAMPLE_RATE ?? 0.01)),
  );

  server.addHook('onRequest', async (request, reply) => {
    const incomingRequestId = request.headers['x-request-id'];
    const requestId = canonicalRequestId(incomingRequestId);

    reply.header('x-request-id', requestId);
    request.headers['x-request-id'] = requestId;
    requestStarts.set(request, performance.now());
  });

  server.addHook('onResponse', async (request, reply) => {
    const requestId = request.headers['x-request-id'];
    const route = request.routeOptions.url ?? request.url.split('?')[0] ?? 'unknown';
    const durationMs = performance.now() - (requestStarts.get(request) ?? performance.now());
    metrics.observeHttp(request.method, route, reply.statusCode, durationMs);
    if (reply.statusCode >= 400 || Math.random() < successLogSampleRate) {
      writeStructuredLog(reply.statusCode >= 500 ? 'error' : 'info', {
        event: 'HTTP_REQUEST_COMPLETED',
        requestId: typeof requestId === 'string' ? requestId : 'unknown',
        method: request.method,
        route,
        status: reply.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
        outcome: reply.statusCode >= 400 ? 'ERROR' : 'COMPLETED',
      });
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
