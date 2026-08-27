import { createOrdersQueue, redisOpsConnectionFromEnv } from '@flash-sale/queue';

export const adminOrdersQueue = createOrdersQueue(redisOpsConnectionFromEnv());
