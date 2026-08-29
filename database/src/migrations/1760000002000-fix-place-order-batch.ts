import type { MigrationInterface, QueryRunner } from 'typeorm';
import { PlaceOrderBatch1760000001000 } from './1760000001000-place-order-batch.js';

export class FixPlaceOrderBatch1760000002000 implements MigrationInterface {
  name = 'FixPlaceOrderBatch1760000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION place_order_batch(p_jobs JSONB)
      RETURNS TABLE (job_id VARCHAR(128), status VARCHAR(32), order_id VARCHAR(64), message TEXT)
      LANGUAGE plpgsql
      AS $$
      DECLARE
        product_row RECORD;
        job_row RECORD;
        current_stock INTEGER;
        sold_count INTEGER;
        new_order_id VARCHAR(64);
        job_count INTEGER;
      BEGIN
        IF jsonb_typeof(p_jobs) <> 'array' THEN
          RAISE EXCEPTION 'p_jobs must be a JSON array';
        END IF;

        SELECT COUNT(*) INTO job_count FROM jsonb_array_elements(p_jobs) AS item;
        IF job_count = 0 THEN
          RETURN;
        END IF;

        FOR product_row IN
          SELECT p.product_id, p.remaining_stock, p.is_flash_sale_active
          FROM products AS p
          JOIN (
            SELECT DISTINCT item->>'productId' AS product_id
            FROM jsonb_array_elements(p_jobs) AS item
          ) AS requested ON requested.product_id = p.product_id
          ORDER BY p.product_id
          FOR UPDATE OF p
        LOOP
          current_stock := product_row.remaining_stock;
          sold_count := 0;

          FOR job_row IN
            SELECT DISTINCT ON (item->>'jobId')
              item->>'jobId' AS job_id,
              item->>'userId' AS user_id,
              item->>'productId' AS product_id
            FROM jsonb_array_elements(p_jobs) WITH ORDINALITY AS entries(item, ordinal)
            WHERE item->>'productId' = product_row.product_id
            ORDER BY item->>'jobId', ordinal
          LOOP
            IF EXISTS (SELECT 1 FROM order_results WHERE order_results.job_id = job_row.job_id) THEN
              CONTINUE;
            END IF;

            IF product_row.is_flash_sale_active IS NOT TRUE THEN
              INSERT INTO order_results (job_id, user_id, product_id, status, order_id, processed_at, message)
              VALUES (job_row.job_id, job_row.user_id, job_row.product_id, 'REJECTED_INACTIVE', NULL, CURRENT_TIMESTAMP, 'The flash sale is inactive.')
              ON CONFLICT DO NOTHING;
              CONTINUE;
            END IF;

            IF EXISTS (
              SELECT 1 FROM orders
              WHERE orders.user_id = job_row.user_id AND orders.product_id = job_row.product_id
            ) THEN
              INSERT INTO order_results (job_id, user_id, product_id, status, order_id, processed_at, message)
              VALUES (job_row.job_id, job_row.user_id, job_row.product_id, 'REJECTED_DUPLICATE', NULL, CURRENT_TIMESTAMP, 'The user already has a successful order for this product.')
              ON CONFLICT DO NOTHING;
              CONTINUE;
            END IF;

            IF current_stock <= 0 THEN
              INSERT INTO order_results (job_id, user_id, product_id, status, order_id, processed_at, message)
              VALUES (job_row.job_id, job_row.user_id, job_row.product_id, 'REJECTED_SOLD_OUT', NULL, CURRENT_TIMESTAMP, 'The product is sold out.')
              ON CONFLICT DO NOTHING;
              CONTINUE;
            END IF;

            new_order_id := 'ord-' || md5(job_row.job_id || clock_timestamp()::text || random()::text);
            INSERT INTO orders (id, job_id, user_id, product_id, status, created_at)
            VALUES (new_order_id, job_row.job_id, job_row.user_id, job_row.product_id, 'SUCCESS', CURRENT_TIMESTAMP);

            INSERT INTO order_results (job_id, user_id, product_id, status, order_id, processed_at, message)
            VALUES (job_row.job_id, job_row.user_id, job_row.product_id, 'SUCCESS', new_order_id, CURRENT_TIMESTAMP, 'Order processed and stock decremented successfully.');

            current_stock := current_stock - 1;
            sold_count := sold_count + 1;
          END LOOP;

          IF sold_count > 0 THEN
            UPDATE products
            SET remaining_stock = remaining_stock - sold_count, updated_at = CURRENT_TIMESTAMP
            WHERE products.product_id = product_row.product_id;

            INSERT INTO transactional_outbox (event_id, aggregate_id, event_type, payload, created_at, next_attempt_at)
            VALUES (
              md5(clock_timestamp()::text || random()::text || product_row.product_id)::uuid,
              product_row.product_id,
              'PRODUCT_STOCK_CHANGED',
              jsonb_build_object('productId', product_row.product_id, 'remainingStock', current_stock),
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            );
          END IF;
        END LOOP;

        RETURN QUERY
        SELECT result.job_id, result.status, result.order_id, result.message
        FROM order_results AS result
        JOIN (
          SELECT DISTINCT item->>'jobId' AS job_id
          FROM jsonb_array_elements(p_jobs) AS item
        ) AS requested ON requested.job_id = result.job_id;
      END;
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await new PlaceOrderBatch1760000001000().up(queryRunner);
  }
}
