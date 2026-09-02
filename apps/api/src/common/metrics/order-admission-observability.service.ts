import { performance } from 'node:perf_hooks';
import { Injectable } from '@nestjs/common';
import { writeStructuredLog } from '../logger/structured-log.js';
import { ApiMetricsService } from './api-metrics.service.js';

type AdmissionOutcome = 'success' | 'duplicate' | 'error';

interface OrderAdmissionTiming {
  startedAt: number;
  outcome: AdmissionOutcome;
  jwtMs?: number;
  redisClaimMs?: number;
  duplicateLookupMs?: number;
  enqueueMs?: number;
  totalMs?: number;
}

@Injectable()
export class OrderAdmissionObservabilityService {
  private readonly timings = new WeakMap<object, OrderAdmissionTiming>();
  private readonly slowLogMs = this.readSlowLogThreshold();

  constructor(private readonly metrics: ApiMetricsService) {}

  begin(request: object): void {
    this.timings.set(request, {
      startedAt: performance.now(),
      outcome: 'error',
    });
  }

  startJwtVerification(request: object): number | undefined {
    return this.startStage(request);
  }

  finishJwtVerification(
    request: object,
    startedAt: number | undefined,
    outcome: 'success' | 'error',
  ): void {
    const durationMs = this.finishStage(startedAt);
    const timing = this.timings.get(request);
    if (durationMs === undefined || !timing) return;

    timing.jwtMs = durationMs;
    this.metrics.observeOrderAdmissionJwt(outcome, durationMs);
  }

  recordMissingJwt(request: object): void {
    if (!this.timings.has(request)) return;
    this.metrics.recordOrderAdmissionJwtMissing();
  }

  startRedisClaim(request: object): number | undefined {
    return this.startStage(request);
  }

  finishRedisClaim(
    request: object,
    startedAt: number | undefined,
    outcome: 'acquired' | 'already_exists' | 'error',
  ): void {
    const durationMs = this.finishStage(startedAt);
    const timing = this.timings.get(request);
    if (durationMs === undefined || !timing) return;

    timing.redisClaimMs = durationMs;
    this.metrics.observeOrderAdmissionRedisClaim(outcome, durationMs);
  }

  startDuplicateLookup(request: object): number | undefined {
    return this.startStage(request);
  }

  finishDuplicateLookup(
    request: object,
    startedAt: number | undefined,
    outcome: 'resolved' | 'in_progress' | 'error',
  ): void {
    const durationMs = this.finishStage(startedAt);
    const timing = this.timings.get(request);
    if (durationMs === undefined || !timing) return;

    timing.duplicateLookupMs = durationMs;
    this.metrics.observeOrderAdmissionDuplicateLookup(outcome, durationMs);
  }

  startEnqueue(request: object): number | undefined {
    return this.startStage(request);
  }

  finishEnqueue(
    request: object,
    startedAt: number | undefined,
    outcome: 'success' | 'error',
  ): void {
    const durationMs = this.finishStage(startedAt);
    const timing = this.timings.get(request);
    if (durationMs === undefined || !timing) return;

    timing.enqueueMs = durationMs;
    this.metrics.observeOrderAdmissionEnqueue(outcome, durationMs);
  }

  setOutcome(request: object, outcome: AdmissionOutcome): void {
    const timing = this.timings.get(request);
    if (timing) timing.outcome = outcome;
  }

  completeAdmission(request: object, fallbackOutcome: AdmissionOutcome): void {
    const timing = this.timings.get(request);
    if (!timing || timing.totalMs !== undefined) return;

    if (timing.outcome === 'error') timing.outcome = fallbackOutcome;
    timing.totalMs = Math.max(0, performance.now() - timing.startedAt);
    this.metrics.observeOrderAdmissionTotal(timing.outcome, timing.totalMs);
    this.metrics.observeOrderAdmissionUnaccounted(
      timing.outcome,
      this.unaccountedMs(timing),
    );
  }

  completeResponse(request: object, statusCode: number, requestId: string): void {
    const timing = this.timings.get(request);
    if (!timing) return;

    this.completeAdmission(request, 'error');
    const responseMs = Math.max(0, performance.now() - timing.startedAt);
    this.metrics.observeOrderAdmissionResponse(timing.outcome, responseMs);

    if (responseMs < this.slowLogMs) return;

    const totalMs = timing.totalMs ?? responseMs;
    writeStructuredLog(statusCode >= 500 ? 'error' : 'warn', {
      event: 'ORDER_ADMISSION_SLOW',
      requestId,
      outcomeStatus: statusCode,
      path: timing.outcome === 'success' ? 'unique' : timing.outcome,
      totalMs: this.round(totalMs),
      jwtMs: this.roundOptional(timing.jwtMs),
      redisClaimMs: this.roundOptional(timing.redisClaimMs),
      duplicateLookupMs: this.roundOptional(timing.duplicateLookupMs),
      enqueueMs: this.roundOptional(timing.enqueueMs),
      responseCompletionMs: this.round(responseMs),
      postServiceResponseDelayMs: this.round(Math.max(0, responseMs - totalMs)),
      unaccountedMs: this.round(this.unaccountedMs(timing)),
      outcome: timing.outcome.toUpperCase(),
    });
  }

  private startStage(request: object): number | undefined {
    return this.timings.has(request) ? performance.now() : undefined;
  }

  private finishStage(startedAt: number | undefined): number | undefined {
    return startedAt === undefined ? undefined : Math.max(0, performance.now() - startedAt);
  }

  private unaccountedMs(timing: OrderAdmissionTiming): number {
    const measuredStages = [
      timing.jwtMs,
      timing.redisClaimMs,
      timing.duplicateLookupMs,
      timing.enqueueMs,
    ].reduce<number>((sum, duration) => sum + (duration ?? 0), 0);
    return Math.max(0, (timing.totalMs ?? 0) - measuredStages);
  }

  private round(value: number): number {
    return Number(value.toFixed(3));
  }

  private roundOptional(value: number | undefined): number | undefined {
    return value === undefined ? undefined : this.round(value);
  }

  private readSlowLogThreshold(): number {
    const configured = Number(process.env.ORDER_ADMISSION_SLOW_LOG_MS ?? 1_000);
    return Number.isFinite(configured) && configured >= 0 ? configured : 1_000;
  }
}
