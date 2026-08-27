import { describe, expect, it } from 'vitest';
import { canonicalRequestId, isUuidV4 } from './request-id.js';

describe('canonicalRequestId', () => {
  it('preserves an inbound UUID v4 exactly', () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174000';

    expect(canonicalRequestId(requestId)).toBe(requestId);
  });

  it.each([undefined, '', 'abc123', '123e4567-e89b-12d3-a456-426614174000'])(
    'replaces invalid request ID %j with a UUID v4',
    (requestId) => {
      expect(isUuidV4(canonicalRequestId(requestId))).toBe(true);
    },
  );
});
