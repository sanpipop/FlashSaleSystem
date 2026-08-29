\set ON_ERROR_STOP on

SELECT
  (SELECT COUNT(*) FROM products WHERE product_id = :'product_id')::integer AS product_rows,
  COALESCE((SELECT remaining_stock FROM products WHERE product_id = :'product_id'), 0)::integer AS remaining_stock,
  (SELECT COUNT(*) FROM orders WHERE product_id = :'product_id' AND status = 'SUCCESS')::integer AS successful_orders,
  (SELECT COUNT(DISTINCT user_id) FROM orders WHERE product_id = :'product_id' AND status = 'SUCCESS')::integer AS distinct_successful_users,
  (SELECT COUNT(*) FROM (SELECT user_id, product_id FROM orders GROUP BY user_id, product_id HAVING COUNT(*) > 1) duplicate_pairs)::integer AS duplicate_successful_pairs,
  (SELECT COUNT(*) FROM products WHERE remaining_stock < 0)::integer AS negative_stock_rows,
  (SELECT COUNT(*) FROM order_results result LEFT JOIN orders placed_order ON placed_order.id = result.order_id WHERE result.status = 'SUCCESS' AND placed_order.id IS NULL)::integer AS orphan_success_results,
  (SELECT COUNT(*) FROM order_results WHERE product_id = :'product_id')::integer AS durable_results;
