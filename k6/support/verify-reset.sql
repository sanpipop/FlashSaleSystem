\set ON_ERROR_STOP on

SELECT
  (SELECT COUNT(*) FROM products
    WHERE product_id = :'product_id'
      AND remaining_stock = :'reset_stock'::integer
      AND is_flash_sale_active = true)::integer AS matching_product_rows,
  (SELECT COUNT(*) FROM orders WHERE product_id = :'product_id')::integer AS order_rows,
  (SELECT COUNT(*) FROM order_results WHERE product_id = :'product_id')::integer AS result_rows;
