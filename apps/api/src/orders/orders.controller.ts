import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { OrderAdmissionResponse } from '@flash-sale/contracts';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { OrderAdmissionObservabilityService } from '../common/metrics/order-admission-observability.service.js';
import { CreateOrderDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderAdmissionObservability: OrderAdmissionObservabilityService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  async admit(
    @Req() request: FastifyRequest,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderAdmissionResponse> {
    const authenticatedRequest = request as AuthenticatedRequest;
    const userId = authenticatedRequest.user?.userId;
    const requestId = request.headers['x-request-id'];
    if (!userId || typeof requestId !== 'string') {
      throw new Error('Authenticated request context is incomplete');
    }
    try {
      const response = await this.ordersService.admit(userId, dto.productId, requestId, request);
      this.orderAdmissionObservability.completeAdmission(request, 'error');
      return response;
    } catch (error) {
      this.orderAdmissionObservability.completeAdmission(request, 'error');
      throw error;
    }
  }
}
