import Redis, { type RedisOptions } from 'ioredis';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`Invalid Redis port: ${value ?? ''}`);
  }

  return parsed;
}

export function redisCacheOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RedisOptions {
  return {
    host: env.REDIS_CACHE_HOST ?? '127.0.0.1',
    port: parsePort(env.REDIS_CACHE_PORT, 6379),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  };
}

export function createRedisCacheClient(
  env: NodeJS.ProcessEnv = process.env,
): Redis {
  return new Redis(redisCacheOptionsFromEnv(env));
}
