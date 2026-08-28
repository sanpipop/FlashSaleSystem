\set ON_ERROR_STOP on

BEGIN;

DELETE FROM transactional_outbox WHERE aggregate_id = :'product_id';
DELETE FROM order_results WHERE product_id = :'product_id';
DELETE FROM orders WHERE product_id = :'product_id';

UPDATE products
SET remaining_stock = :'reset_stock'::integer,
    is_flash_sale_active = true,
    updated_at = CURRENT_TIMESTAMP
WHERE product_id = :'product_id';

SELECT COUNT(*) = 1 AS reset_product_ok
FROM products
WHERE product_id = :'product_id'
  AND remaining_stock = :'reset_stock'::integer
  AND is_flash_sale_active = true
\gset

\if :reset_product_ok
  COMMIT;
\else
  \echo 'FAIL: benchmark product reset did not affect exactly one row.'
  \quit 1
\endif
