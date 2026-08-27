import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OrderResultEntity } from './entities/order-result.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { ProductEntity } from './entities/product.entity.js';
import { TransactionalOutboxEntity } from './entities/transactional-outbox.entity.js';
import { InitialSchema1760000000000 } from './migrations/1760000000000-initial-schema.js';
import { PlaceOrderBatch1760000001000 } from './migrations/1760000001000-place-order-batch.js';
import { FixPlaceOrderBatch1760000002000 } from './migrations/1760000002000-fix-place-order-batch.js';

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value ?? ''}`);
  }

  return parsed;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? '127.0.0.1',
  port: positiveInteger(process.env.POSTGRES_PORT, 5432),
  database: process.env.POSTGRES_DB ?? 'flashsale',
  username: process.env.POSTGRES_USER ?? 'flashsale',
  password: process.env.POSTGRES_PASSWORD ?? 'local-only-change-me',
  synchronize: false,
  logging: false,
  poolSize: positiveInteger(process.env.POSTGRES_POOL_MAX, 12),
  entities: [
    ProductEntity,
    OrderEntity,
    OrderResultEntity,
    TransactionalOutboxEntity,
  ],
  migrations: [
    InitialSchema1760000000000,
    PlaceOrderBatch1760000001000,
    FixPlaceOrderBatch1760000002000,
  ],
});
