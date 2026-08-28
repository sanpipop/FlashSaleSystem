\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('benchmark.product_id', :'product_id', true);
SELECT set_config('benchmark.reset_stock', :'reset_stock', true);

DELETE FROM transactional_outbox WHERE aggregate_id = :'product_id';
DELETE FROM order_results WHERE product_id = :'product_id';
DELETE FROM orders WHERE product_id = :'product_id';

UPDATE products
SET remaining_stock = :'reset_stock'::integer,
    is_flash_sale_active = true,
    updated_at = CURRENT_TIMESTAMP
WHERE product_id = :'product_id';

DO $benchmark_reset$
DECLARE
  matching_product_rows integer;
BEGIN
  SELECT COUNT(*)
  INTO matching_product_rows
  FROM products
  WHERE product_id = current_setting('benchmark.product_id')
    AND remaining_stock = current_setting('benchmark.reset_stock')::integer
    AND is_flash_sale_active = true;

  IF matching_product_rows <> 1 THEN
    RAISE EXCEPTION 'benchmark product reset did not affect exactly one row';
  END IF;
END
$benchmark_reset$;

COMMIT;
