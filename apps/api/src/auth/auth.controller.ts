import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthTokenResponse } from '@flash-sale/contracts';
import { AuthTokenDto } from './auth.dto.js';
import { JwtTokenService } from './jwt-token.service.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  issueToken(@Body() dto: AuthTokenDto): AuthTokenResponse {
    return {
      status: 'success',
      accessToken: this.jwtTokenService.issue(dto.userId),
    };
  }
}
