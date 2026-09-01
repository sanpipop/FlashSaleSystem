import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { OrderAdmissionObservabilityService } from '../common/metrics/order-admission-observability.service.js';
import { JwtTokenService, type VerifiedJwtUser } from './jwt-token.service.js';

export type AuthenticatedRequest = FastifyRequest & { user?: VerifiedJwtUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly orderAdmissionObservability: OrderAdmissionObservabilityService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';

    if (!token) {
      this.orderAdmissionObservability.recordMissingJwt(request);
      throw new UnauthorizedException('Missing Bearer token');
    }

    const startedAt = this.orderAdmissionObservability.startJwtVerification(request);
    try {
      request.user = this.jwtTokenService.verify(token);
      this.orderAdmissionObservability.finishJwtVerification(request, startedAt, 'success');
      return true;
    } catch {
      this.orderAdmissionObservability.finishJwtVerification(request, startedAt, 'error');
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
