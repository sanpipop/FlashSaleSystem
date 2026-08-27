function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return parsed;
}

export interface WorkerSettings {
  concurrency: number;
  batchSize: number;
  batchWaitMs: number;
}

export function workerSettingsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WorkerSettings {
  return {
    concurrency: boundedInteger(
      env.WORKER_CONCURRENCY,
      8,
      1,
      64,
      'WORKER_CONCURRENCY',
    ),
    batchSize: boundedInteger(
      env.WORKER_BATCH_SIZE,
      16,
      1,
      32,
      'WORKER_BATCH_SIZE',
    ),
    batchWaitMs: boundedInteger(
      env.WORKER_BATCH_WAIT_MS,
      1,
      0,
      10,
      'WORKER_BATCH_WAIT_MS',
    ),
  };
}
