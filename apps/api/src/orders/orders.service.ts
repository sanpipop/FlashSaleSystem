import { Injectable } from '@nestjs/common';
import { createOrderJobId } from '@flash-sale/queue';
import type { OrderAdmissionResponse } from '@flash-sale/contracts';
import { ApiException } from '../common/api-exception.js';
import { ProductsService } from '../products/products.service.js';
import { OrderClaimService } from './order-claim.service.js';
import { OrderQueueProducer } from './order-queue.producer.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly claimService: OrderClaimService,
    private readonly queueProducer: OrderQueueProducer,
  ) {}

  async admit(userId: string, productId: string, requestId: string): Promise<OrderAdmissionResponse> {
    const product = await this.productsService.findById(productId);
    if (!product) {
      throw new ApiException(404, 'PRODUCT_NOT_FOUND', 'The requested product does not exist.');
    }
    if (!product.isFlashSaleActive) {
      throw new ApiException(422, 'FLASH_SALE_INACTIVE', 'The flash sale is not active.');
    }

    const jobId = createOrderJobId(userId, productId);
    let claim;
    try {
      claim = await this.claimService.acquire(userId, productId);
    } catch {
      throw new ApiException(503, 'QUEUE_UNAVAILABLE', 'The order queue is unavailable.');
    }

    if (!claim.acquired) {
      return this.confirmDuplicate(jobId);
    }

    try {
      await this.queueProducer.enqueue({
        jobId,
        requestId,
        userId,
        productId,
        createdAt: new Date().toISOString(),
      });
    } catch {
      await this.claimService.releaseIfOwned(userId, productId, claim.token).catch(() => undefined);
      throw new ApiException(503, 'QUEUE_UNAVAILABLE', 'The order queue is unavailable.');
    }

    return this.accepted(jobId);
  }

  private async confirmDuplicate(jobId: string): Promise<OrderAdmissionResponse> {
    try {
      if (await this.queueProducer.findJob(jobId)) {
        return this.accepted(jobId);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (await this.queueProducer.findJob(jobId)) {
        return this.accepted(jobId);
      }
    } catch {
      throw new ApiException(503, 'QUEUE_UNAVAILABLE', 'The order queue is unavailable.');
    }

    throw new ApiException(409, 'ORDER_ADMISSION_IN_PROGRESS', 'The order admission is still in progress.');
  }

  private accepted(jobId: string): OrderAdmissionResponse {
    return {
      status: 'processing',
      orderJobId: jobId,
      message: 'Your order has been accepted and is processing in the queue.',
    };
  }
}
