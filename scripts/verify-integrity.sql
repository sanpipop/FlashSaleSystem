SELECT product_id, available_stock, remaining_stock
FROM products
WHERE product_id = 'p-1001';

SELECT COUNT(*) AS negative_stock_count
FROM products
WHERE remaining_stock < 0;

SELECT user_id, product_id, COUNT(*) AS duplicate_count
FROM orders
GROUP BY user_id, product_id
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS orphan_success_result_count
FROM order_results AS result
LEFT JOIN orders AS placed_order ON placed_order.id = result.order_id
WHERE result.status = 'SUCCESS' AND placed_order.id IS NULL;
