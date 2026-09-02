import { Injectable } from '@nestjs/common';
import { createOrderJobId } from '@flash-sale/queue';
import type { OrderAdmissionResponse } from '@flash-sale/contracts';
import { ApiException } from '../common/api-exception.js';
import { writeStructuredLog } from '../common/logger/structured-log.js';
import { OrderAdmissionObservabilityService } from '../common/metrics/order-admission-observability.service.js';
import { OrderClaimService } from './order-claim.service.js';
import { OrderQueueProducer } from './order-queue.producer.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly claimService: OrderClaimService,
    private readonly queueProducer: OrderQueueProducer,
    private readonly orderAdmissionObservability: OrderAdmissionObservabilityService,
  ) {}

  async admit(
    userId: string,
    productId: string,
    requestId: string,
    request: object,
  ): Promise<OrderAdmissionResponse> {
    const jobId = createOrderJobId(userId, productId);
    let claim;
    const claimStartedAt = this.orderAdmissionObservability.startRedisClaim(request);
    try {
      claim = await this.claimService.acquire(userId, productId);
      this.orderAdmissionObservability.finishRedisClaim(
        request,
        claimStartedAt,
        claim.acquired ? 'acquired' : 'already_exists',
      );
    } catch {
      this.orderAdmissionObservability.finishRedisClaim(request, claimStartedAt, 'error');
      this.orderAdmissionObservability.setOutcome(request, 'error');
      throw new ApiException(503, 'QUEUE_UNAVAILABLE', 'The order queue is unavailable.');
    }

    if (!claim.acquired) {
      return this.confirmDuplicate(jobId, request);
    }

    const enqueueStartedAt = this.orderAdmissionObservability.startEnqueue(request);
    try {
      await this.queueProducer.enqueue({
        jobId,
        requestId,
        userId,
        productId,
        createdAt: new Date().toISOString(),
      });
      this.orderAdmissionObservability.finishEnqueue(request, enqueueStartedAt, 'success');
      this.orderAdmissionObservability.setOutcome(request, 'success');
      writeStructuredLog('info', {
        event: 'ORDER_ENQUEUED',
        requestId,
        jobId,
        productId,
        outcome: 'ADMITTED',
      });
    } catch {
      this.orderAdmissionObservability.finishEnqueue(request, enqueueStartedAt, 'error');
      this.orderAdmissionObservability.setOutcome(request, 'error');
      await this.claimService.releaseIfOwned(userId, productId, claim.token).catch(() => undefined);
      throw new ApiException(503, 'QUEUE_UNAVAILABLE', 'The order queue is unavailable.');
    }

    return this.accepted(jobId);
  }

  private async confirmDuplicate(jobId: string, request: object): Promise<OrderAdmissionResponse> {
    const lookupStartedAt = this.orderAdmissionObservability.startDuplicateLookup(request);
    try {
      if (await this.queueProducer.findJob(jobId)) {
        this.orderAdmissionObservability.finishDuplicateLookup(request, lookupStartedAt, 'resolved');
        this.orderAdmissionObservability.setOutcome(request, 'duplicate');
        return this.accepted(jobId);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (await this.queueProducer.findJob(jobId)) {
        this.orderAdmissionObservability.finishDuplicateLookup(request, lookupStartedAt, 'resolved');
        this.orderAdmissionObservability.setOutcome(request, 'duplicate');
        return this.accepted(jobId);
      }
    } catch {
      this.orderAdmissionObservability.finishDuplicateLookup(request, lookupStartedAt, 'error');
      this.orderAdmissionObservability.setOutcome(request, 'error');
      throw new ApiException(503, 'QUEUE_UNAVAILABLE', 'The order queue is unavailable.');
    }

    this.orderAdmissionObservability.finishDuplicateLookup(request, lookupStartedAt, 'in_progress');
    this.orderAdmissionObservability.setOutcome(request, 'duplicate');
    throw new ApiException(409, 'ORDER_ADMISSION_IN_PROGRESS', 'The order admission is still in progress.');
  }

  private accepted(jobId: string): OrderAdmissionResponse {
    return {
      status: 'processing',
      orderJobId: jobId,
      message: 'Your order is in the queue.',
    };
  }
}
