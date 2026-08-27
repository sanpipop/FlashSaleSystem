export type StructuredLogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  event: string;
  requestId?: string;
  jobId?: string;
  productId?: string;
  outcome?: string;
  durationMs?: number;
  [key: string]: string | number | boolean | undefined;
}

export function writeStructuredLog(
  level: StructuredLogLevel,
  entry: StructuredLogEntry,
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'api-service',
    instance: process.env.INSTANCE_ID ?? 'api-local',
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
