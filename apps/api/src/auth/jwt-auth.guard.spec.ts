import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function contextFor(request: { headers: Record<string, string>; user?: unknown }): never {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

interface ObservabilitySpies {
  startJwtVerification: ReturnType<typeof vi.fn>;
  finishJwtVerification: ReturnType<typeof vi.fn>;
  recordMissingJwt: ReturnType<typeof vi.fn>;
}

function createObservability(): ObservabilitySpies {
  return {
    startJwtVerification: vi.fn().mockReturnValue(1),
    finishJwtVerification: vi.fn(),
    recordMissingJwt: vi.fn(),
  };
}

describe('JwtAuthGuard order admission timing', () => {
  it('measures only the JWT verifier call when verification succeeds', () => {
    const observability = createObservability();
    const verify = vi.fn().mockReturnValue({ userId: 'user-001' });
    const guard = new JwtAuthGuard({ verify } as never, observability as never);
    const request = { headers: { authorization: 'Bearer redacted-jwt-value' } };

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(verify).toHaveBeenCalledWith('redacted-jwt-value');
    expect(observability.finishJwtVerification).toHaveBeenCalledWith(request, 1, 'success');
  });

  it('records an actual verification failure without changing the 401 guard behavior', () => {
    const observability = createObservability();
    const guard = new JwtAuthGuard(
      { verify: vi.fn().mockImplementation(() => { throw new Error('invalid'); }) } as never,
      observability as never,
    );
    const request = { headers: { authorization: 'Bearer redacted-jwt-value' } };

    expect(() => guard.canActivate(contextFor(request))).toThrow('Invalid JWT token');
    expect(observability.finishJwtVerification).toHaveBeenCalledWith(request, 1, 'error');
  });

  it('counts a missing bearer token without assigning it a fake verification duration', () => {
    const observability = createObservability();
    const guard = new JwtAuthGuard({ verify: vi.fn() } as never, observability as never);
    const request = { headers: {} };

    expect(() => guard.canActivate(contextFor(request))).toThrow('Missing Bearer token');
    expect(observability.recordMissingJwt).toHaveBeenCalledWith(request);
    expect(observability.startJwtVerification).not.toHaveBeenCalled();
  });
});
