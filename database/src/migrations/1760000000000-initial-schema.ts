import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE products (
        product_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL CONSTRAINT chk_products_price_non_negative CHECK (price >= 0),
        available_stock INTEGER NOT NULL CONSTRAINT chk_products_available_stock_non_negative CHECK (available_stock >= 0),
        remaining_stock INTEGER NOT NULL CONSTRAINT chk_products_remaining_stock_non_negative CHECK (remaining_stock >= 0),
        is_flash_sale_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE orders (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(128) NOT NULL CONSTRAINT uq_orders_job_id UNIQUE,
        user_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL REFERENCES products(product_id),
        status VARCHAR(32) NOT NULL CONSTRAINT chk_orders_status_success CHECK (status = 'SUCCESS'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_product UNIQUE (user_id, product_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE order_results (
        job_id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL REFERENCES products(product_id),
        status VARCHAR(32) NOT NULL CONSTRAINT chk_order_results_status CHECK (
          status IN ('SUCCESS', 'REJECTED_SOLD_OUT', 'REJECTED_INACTIVE', 'REJECTED_DUPLICATE')
        ),
        order_id VARCHAR(64) NULL REFERENCES orders(id),
        processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        message TEXT NOT NULL,
        CONSTRAINT result_order_consistency CHECK (
          (status = 'SUCCESS' AND order_id IS NOT NULL)
          OR (status <> 'SUCCESS' AND order_id IS NULL)
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE transactional_outbox (
        event_id UUID PRIMARY KEY,
        aggregate_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL CONSTRAINT chk_outbox_event_type CHECK (
          event_type = 'PRODUCT_STOCK_CHANGED'
        ),
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMPTZ NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_outbox_pending
      ON transactional_outbox (next_attempt_at, created_at)
      WHERE published_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS transactional_outbox');
    await queryRunner.query('DROP TABLE IF EXISTS order_results');
    await queryRunner.query('DROP TABLE IF EXISTS orders');
    await queryRunner.query('DROP TABLE IF EXISTS products');
  }
}
