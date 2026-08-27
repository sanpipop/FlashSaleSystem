import { describe, expect, it } from 'vitest';
import { createOrderJobId } from './job-id.js';

describe('createOrderJobId', () => {
  it('is deterministic and valid for BullMQ custom IDs', () => {
    const first = createOrderJobId('user-001', 'p-1001');
    const second = createOrderJobId('user-001', 'p-1001');

    expect(first).toBe(second);
    expect(first).toMatch(/^ord-[a-f0-9]{64}$/);
    expect(first).not.toContain(':');
  });

  it('changes when either side of the uniqueness tuple changes', () => {
    expect(createOrderJobId('user-001', 'p-1001')).not.toBe(
      createOrderJobId('user-002', 'p-1001'),
    );
    expect(createOrderJobId('user-001', 'p-1001')).not.toBe(
      createOrderJobId('user-001', 'p-1002'),
    );
  });
});
