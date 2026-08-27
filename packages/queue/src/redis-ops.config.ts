import type { ConnectionOptions } from 'bullmq';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`Invalid Redis port: ${value ?? ''}`);
  }

  return parsed;
}

export function redisOpsConnectionFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ConnectionOptions {
  return {
    host: env.REDIS_OPS_HOST ?? '127.0.0.1',
    port: parsePort(env.REDIS_OPS_PORT, 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}
