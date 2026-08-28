\set ON_ERROR_STOP on

SELECT
  (SELECT remaining_stock FROM products WHERE product_id = :'product_id') AS remaining_stock,
  (SELECT COUNT(*) FROM orders WHERE product_id = :'product_id' AND status = 'SUCCESS') AS successful_orders,
  (SELECT COUNT(DISTINCT user_id) FROM orders WHERE product_id = :'product_id' AND status = 'SUCCESS') AS distinct_successful_users,
  (SELECT COUNT(*) FROM (SELECT user_id, product_id FROM orders GROUP BY user_id, product_id HAVING COUNT(*) > 1) duplicate_pairs) AS duplicate_successful_pairs,
  (SELECT COUNT(*) FROM products WHERE remaining_stock < 0) AS negative_stock_rows,
  (SELECT COUNT(*) FROM order_results result LEFT JOIN orders placed_order ON placed_order.id = result.order_id WHERE result.status = 'SUCCESS' AND placed_order.id IS NULL) AS orphan_success_results,
  (SELECT COUNT(*) FROM order_results WHERE product_id = :'product_id') AS durable_results;

SELECT COUNT(*) = 0 AS integrity_ok
FROM (
  SELECT 1 WHERE (SELECT remaining_stock FROM products WHERE product_id = :'product_id') <> :'expected_stock'::integer
  UNION ALL
  SELECT 1 WHERE (SELECT COUNT(*) FROM orders WHERE product_id = :'product_id' AND status = 'SUCCESS') <> :'expected_successes'::integer
  UNION ALL
  SELECT 1 WHERE (SELECT COUNT(DISTINCT user_id) FROM orders WHERE product_id = :'product_id' AND status = 'SUCCESS') <> :'expected_successes'::integer
  UNION ALL
  SELECT 1 WHERE EXISTS (SELECT 1 FROM orders GROUP BY user_id, product_id HAVING COUNT(*) > 1)
  UNION ALL
  SELECT 1 WHERE EXISTS (SELECT 1 FROM products WHERE remaining_stock < 0)
  UNION ALL
  SELECT 1 WHERE EXISTS (SELECT 1 FROM order_results result LEFT JOIN orders placed_order ON placed_order.id = result.order_id WHERE result.status = 'SUCCESS' AND placed_order.id IS NULL)
  UNION ALL
  SELECT 1 WHERE (SELECT COUNT(*) FROM order_results WHERE product_id = :'product_id') <> :'expected_jobs'::integer
) failures
\gset

\if :integrity_ok
  \echo 'PASS: PostgreSQL integrity conditions satisfied.'
\else
  \echo 'FAIL: one or more PostgreSQL integrity conditions failed.'
  \quit 1
\endif
