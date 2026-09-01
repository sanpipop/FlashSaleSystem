export const ORDER_QUEUE_NAME = 'orders' as const;
export const PROCESS_ORDER_JOB_NAME = 'process-order' as const;

export interface OrderJobPayload {
  jobId: string;
  requestId: string;
  userId: string;
  productId: string;
  createdAt: string;
}

export type BusinessResultStatus =
  | 'SUCCESS'
  | 'REJECTED_SOLD_OUT'
  | 'REJECTED_INACTIVE'
  | 'REJECTED_DUPLICATE';

export interface OrderJobResult {
  status: BusinessResultStatus;
  jobId: string;
  userId: string;
  productId: string;
  orderId?: string;
  remainingStock?: number;
  processedAt: string;
  message: string;
}
