export type StructuredLogLevel = 'info' | 'warn' | 'error';

export interface WorkerLogEntry {
  event: string;
  requestId?: string;
  jobId?: string;
  userId?: string;
  productId?: string;
  outcome?: string;
  durationMs?: number;
  [key: string]: string | number | boolean | undefined;
}

export function writeStructuredLog(
  level: StructuredLogLevel,
  entry: WorkerLogEntry,
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'worker-service',
    ...entry,
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
