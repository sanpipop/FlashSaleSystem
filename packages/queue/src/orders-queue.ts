import {
  ORDER_QUEUE_NAME,
  PROCESS_ORDER_JOB_NAME,
  type OrderJobPayload,
  type OrderJobResult,
} from '@flash-sale/contracts';
import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';

export const ORDER_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 100 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 259_200, count: 5_000 },
} satisfies JobsOptions;

export type OrdersQueue = Queue<OrderJobPayload, OrderJobResult>;

export function createOrdersQueue(connection: ConnectionOptions): OrdersQueue {
  return new Queue<OrderJobPayload, OrderJobResult>(ORDER_QUEUE_NAME, {
    connection,
    defaultJobOptions: ORDER_JOB_OPTIONS,
  });
}

export async function enqueueOrderJob(
  queue: OrdersQueue,
  payload: OrderJobPayload,
): Promise<string> {
  const job = await queue.add(PROCESS_ORDER_JOB_NAME, payload, {
    ...ORDER_JOB_OPTIONS,
    jobId: payload.jobId,
  });

  return job.id ?? payload.jobId;
}
