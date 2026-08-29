import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface VerifiedJwtUser {
  userId: string;
}

interface JwtPayload {
  sub?: unknown;
  exp?: unknown;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

@Injectable()
export class JwtTokenService {
  private readonly secret = this.readSecret();

  issue(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userId,
      iat: now,
      exp: now + this.expirySeconds(),
    };
    const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = encode(JSON.stringify(payload));
    const unsignedToken = `${header}.${encodedPayload}`;
    return `${unsignedToken}.${this.signature(unsignedToken)}`;
  }

  verify(token: string): VerifiedJwtUser {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT structure');
    }

    const [header, payload, signature] = parts;
    if (!header || !payload || !signature) {
      throw new Error('Invalid JWT structure');
    }

    const expected = this.signature(`${header}.${payload}`);
    const receivedBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (
      receivedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(receivedBytes, expectedBytes)
    ) {
      throw new Error('Invalid JWT signature');
    }

    let parsedPayload: JwtPayload;
    try {
      parsedPayload = JSON.parse(decode(payload)) as JwtPayload;
    } catch {
      throw new Error('Invalid JWT payload');
    }

    if (
      typeof parsedPayload.sub !== 'string' ||
      parsedPayload.sub.length === 0 ||
      typeof parsedPayload.exp !== 'number' ||
      parsedPayload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error('Invalid JWT claims');
    }

    return { userId: parsedPayload.sub };
  }

  private signature(unsignedToken: string): string {
    return createHmac('sha256', this.secret)
      .update(unsignedToken, 'utf8')
      .digest('base64url');
  }

  private readSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET must be configured');
    }
    return secret;
  }

  private expirySeconds(): number {
    const value = process.env.JWT_EXPIRES_IN ?? '1h';
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match || !match[1] || !match[2]) {
      return 3600;
    }
    const amount = Number(match[1]);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * (multipliers[match[2]] ?? 3600);
  }
}
