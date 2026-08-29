import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtTokenService, type VerifiedJwtUser } from './jwt-token.service.js';

export type AuthenticatedRequest = FastifyRequest & { user?: VerifiedJwtUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';

    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    try {
      request.user = this.jwtTokenService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
