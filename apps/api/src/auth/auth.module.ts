import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtTokenService } from './jwt-token.service.js';

@Module({
  controllers: [AuthController],
  providers: [JwtTokenService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtTokenService],
})
export class AuthModule {}
