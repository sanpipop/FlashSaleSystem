import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '@flash-sale/contracts';
import { OrderAdmissionObservabilityService } from './metrics/order-admission-observability.service.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly orderAdmissionObservability?: OrderAdmissionObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const statusCode = Number(status);
    const response = exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseRecord = typeof response === 'object' && response !== null ? response as Record<string, unknown> : {};
    const code = typeof responseRecord.code === 'string'
      ? responseRecord.code
      : this.codeForStatus(statusCode);
    const message = typeof responseRecord.message === 'string'
      ? responseRecord.message
      : statusCode === 400
        ? 'The request payload is invalid.'
        : statusCode === 401
          ? 'The provided JWT access token is invalid or missing.'
          : 'An unexpected error occurred.';
    const requestId = this.requestId(request);

    this.orderAdmissionObservability?.setOutcome(request, 'error');
    this.orderAdmissionObservability?.completeAdmission(request, 'error');
    reply.status(status).send({ status: 'error', code, message, requestId } satisfies ApiErrorResponse);
  }

  private codeForStatus(status: number): string {
    if (status === 400) return 'INVALID_PAYLOAD';
    if (status === 401) return 'INVALID_JWT_TOKEN';
    if (status === 404) return 'PRODUCT_NOT_FOUND';
    if (status === 409) return 'ORDER_ADMISSION_IN_PROGRESS';
    if (status === 422) return 'FLASH_SALE_INACTIVE';
    if (status === 503) return 'QUEUE_UNAVAILABLE';
    return 'INTERNAL_SERVER_ERROR';
  }

  private requestId(request: FastifyRequest): string {
    const requestId = request.headers['x-request-id'];
    return typeof requestId === 'string' && requestId.length > 0 ? requestId : 'unknown';
  }
}
