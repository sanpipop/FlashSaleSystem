import type { MigrationInterface, QueryRunner } from 'typeorm';
import { FixPlaceOrderBatch1760000002000 } from './1760000002000-fix-place-order-batch.js';

export class WinningPlaceOrderBatch1760000003000 implements MigrationInterface {
  name = 'WinningPlaceOrderBatch1760000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION place_order_batch(p_jobs JSONB)
      RETURNS TABLE (
        job_id VARCHAR(128),
        status VARCHAR(32),
        order_id VARCHAR(64),
        message TEXT
      )
      LANGUAGE plpgsql
      VOLATILE
      PARALLEL UNSAFE
      AS $$
      DECLARE
        v_product RECORD;
        v_invalid_job_count INTEGER;
        v_conflicting_job_count INTEGER;
      BEGIN
        IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
          RAISE EXCEPTION 'place_order_batch expects a JSON array';
        END IF;

        IF jsonb_array_length(p_jobs) < 1 OR jsonb_array_length(p_jobs) > 32 THEN
          RAISE EXCEPTION 'place_order_batch accepts between 1 and 32 jobs';
        END IF;

        WITH parsed AS (
          SELECT
            item.value ->> 'jobId' AS parsed_job_id,
            item.value ->> 'userId' AS parsed_user_id,
            item.value ->> 'productId' AS parsed_product_id,
            item.value ->> 'requestId' AS parsed_request_id,
            item.value ->> 'createdAt' AS parsed_created_at
          FROM jsonb_array_elements(p_jobs) WITH ORDINALITY AS item(value, ordinal)
        )
        SELECT COUNT(*)
        INTO v_invalid_job_count
        FROM parsed
        WHERE parsed_job_id IS NULL
           OR parsed_job_id !~ '^ord-[0-9a-f]{64}$'
           OR parsed_user_id IS NULL
           OR parsed_user_id = ''
           OR length(parsed_user_id) > 64
           OR parsed_product_id IS NULL
           OR parsed_product_id = ''
           OR length(parsed_product_id) > 64
           OR parsed_request_id IS NULL
           OR parsed_request_id = ''
           OR parsed_created_at IS NULL
           OR parsed_created_at = '';

        IF v_invalid_job_count > 0 THEN
          RAISE EXCEPTION 'place_order_batch received an invalid queue payload';
        END IF;

        WITH parsed AS (
          SELECT
            item.value ->> 'jobId' AS parsed_job_id,
            item.value ->> 'userId' AS parsed_user_id,
            item.value ->> 'productId' AS parsed_product_id
          FROM jsonb_array_elements(p_jobs) AS item(value)
        )
        SELECT COUNT(*)
        INTO v_conflicting_job_count
        FROM (
          SELECT parsed_job_id
          FROM parsed
          GROUP BY parsed_job_id
          HAVING COUNT(DISTINCT (parsed_user_id, parsed_product_id)) > 1
        ) AS conflicts;

        IF v_conflicting_job_count > 0 THEN
          RAISE EXCEPTION 'one jobId cannot reference multiple user/product pairs';
        END IF;

        IF EXISTS (
          WITH input_jobs AS (
            SELECT DISTINCT item.value ->> 'productId' AS product_id
            FROM jsonb_array_elements(p_jobs) AS item(value)
          )
          SELECT 1
          FROM input_jobs
          LEFT JOIN products USING (product_id)
          WHERE products.product_id IS NULL
        ) THEN
          RAISE EXCEPTION 'place_order_batch received an unknown productId';
        END IF;

        FOR v_product IN
          WITH input_jobs AS (
            SELECT DISTINCT item.value ->> 'productId' AS product_id
            FROM jsonb_array_elements(p_jobs) AS item(value)
          )
          SELECT
            product.product_id,
            product.remaining_stock,
            product.is_flash_sale_active
          FROM products AS product
          INNER JOIN input_jobs USING (product_id)
          ORDER BY product.product_id
          FOR UPDATE OF product
        LOOP
          WITH parsed AS (
            SELECT
              item.value ->> 'jobId' AS input_job_id,
              item.value ->> 'userId' AS user_id,
              item.value ->> 'productId' AS product_id,
              item.ordinal::BIGINT AS input_ordinal
            FROM jsonb_array_elements(p_jobs) WITH ORDINALITY AS item(value, ordinal)
          ),
          unique_jobs AS (
            SELECT DISTINCT ON (input_job_id)
              input_job_id,
              user_id,
              product_id,
              input_ordinal
            FROM parsed
            ORDER BY input_job_id, input_ordinal
          ),
          pending_jobs AS (
            SELECT
              unique_job.input_job_id,
              unique_job.user_id,
              unique_job.product_id,
              unique_job.input_ordinal,
              ROW_NUMBER() OVER (
                PARTITION BY unique_job.user_id, unique_job.product_id
                ORDER BY unique_job.input_ordinal, unique_job.input_job_id
              ) AS pair_rank,
              EXISTS (
                SELECT 1
                FROM orders AS existing_order
                WHERE existing_order.user_id = unique_job.user_id
                  AND existing_order.product_id = unique_job.product_id
              ) AS already_purchased
            FROM unique_jobs AS unique_job
            LEFT JOIN order_results AS existing_result
              ON existing_result.job_id = unique_job.input_job_id
            WHERE existing_result.job_id IS NULL
              AND unique_job.product_id = v_product.product_id
          ),
          eligible_jobs AS (
            SELECT
              pending_job.*,
              ROW_NUMBER() OVER (
                ORDER BY pending_job.input_ordinal, pending_job.input_job_id
              ) AS stock_rank
            FROM pending_jobs AS pending_job
            WHERE pending_job.pair_rank = 1
              AND NOT pending_job.already_purchased
              AND v_product.is_flash_sale_active
          ),
          inserted_orders AS (
            INSERT INTO orders (id, job_id, user_id, product_id, status)
            SELECT
              'o-' || substring(eligible_job.input_job_id FROM 5 FOR 62),
              eligible_job.input_job_id,
              eligible_job.user_id,
              eligible_job.product_id,
              'SUCCESS'
            FROM eligible_jobs AS eligible_job
            WHERE eligible_job.stock_rank <= v_product.remaining_stock
            ORDER BY eligible_job.stock_rank
            ON CONFLICT DO NOTHING
            RETURNING orders.id, orders.job_id
          ),
          stock_update AS (
            UPDATE products AS product
            SET
              remaining_stock = product.remaining_stock - (
                SELECT COUNT(*)::INTEGER FROM inserted_orders
              ),
              updated_at = CURRENT_TIMESTAMP
            WHERE product.product_id = v_product.product_id
              AND EXISTS (SELECT 1 FROM inserted_orders)
            RETURNING product.product_id, product.remaining_stock
          ),
          inserted_results AS (
            INSERT INTO order_results (
              job_id,
              user_id,
              product_id,
              status,
              order_id,
              message
            )
            SELECT
              pending_job.input_job_id,
              pending_job.user_id,
              pending_job.product_id,
              CASE
                WHEN inserted_order.id IS NOT NULL THEN 'SUCCESS'
                WHEN pending_job.pair_rank > 1 OR pending_job.already_purchased
                  THEN 'REJECTED_DUPLICATE'
                WHEN NOT v_product.is_flash_sale_active THEN 'REJECTED_INACTIVE'
                ELSE 'REJECTED_SOLD_OUT'
              END,
              inserted_order.id,
              CASE
                WHEN inserted_order.id IS NOT NULL
                  THEN 'Order processed and stock decremented successfully.'
                WHEN pending_job.pair_rank > 1 OR pending_job.already_purchased
                  THEN 'User has already purchased this product.'
                WHEN NOT v_product.is_flash_sale_active
                  THEN 'Flash sale is not active for this product.'
                ELSE 'Product is sold out.'
              END
            FROM pending_jobs AS pending_job
            LEFT JOIN inserted_orders AS inserted_order
              ON inserted_order.job_id = pending_job.input_job_id
            ON CONFLICT ON CONSTRAINT order_results_pkey DO NOTHING
            RETURNING order_results.job_id
          ),
          inserted_outbox AS (
            INSERT INTO transactional_outbox (
              event_id,
              aggregate_id,
              event_type,
              payload
            )
            SELECT
              gen_random_uuid(),
              stock_update.product_id,
              'PRODUCT_STOCK_CHANGED',
              jsonb_build_object(
                'productId', stock_update.product_id,
                'remainingStock', stock_update.remaining_stock
              )
            FROM stock_update
            RETURNING event_id
          )
          SELECT
            (SELECT COUNT(*) FROM inserted_results),
            (SELECT COUNT(*) FROM inserted_outbox)
          INTO v_invalid_job_count, v_conflicting_job_count;
        END LOOP;

        RETURN QUERY
        WITH parsed AS (
          SELECT
            item.value ->> 'jobId' AS input_job_id,
            item.ordinal::BIGINT AS input_ordinal
          FROM jsonb_array_elements(p_jobs) WITH ORDINALITY AS item(value, ordinal)
        ),
        unique_jobs AS (
          SELECT DISTINCT ON (input_job_id)
            input_job_id,
            input_ordinal
          FROM parsed
          ORDER BY input_job_id, input_ordinal
        )
        SELECT
          result.job_id,
          result.status,
          result.order_id,
          result.message
        FROM unique_jobs AS input_job
        INNER JOIN order_results AS result
          ON result.job_id = input_job.input_job_id
        ORDER BY input_job.input_ordinal;
      END;
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await new FixPlaceOrderBatch1760000002000().up(queryRunner);
  }
}
