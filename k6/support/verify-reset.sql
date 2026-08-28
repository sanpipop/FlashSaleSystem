\set ON_ERROR_STOP on

SELECT COUNT(*) = 1 AS reset_product_ok
FROM products
WHERE product_id = :'product_id'
  AND remaining_stock = :'reset_stock'::integer
  AND is_flash_sale_active = true
\gset

SELECT COUNT(*) = 0 AS reset_order_ok
FROM orders
WHERE product_id = :'product_id'
\gset

SELECT COUNT(*) = 0 AS reset_result_ok
FROM order_results
WHERE product_id = :'product_id'
\gset

\if :reset_product_ok
  \if :reset_order_ok
    \if :reset_result_ok
  \echo 'PASS: PostgreSQL reset postconditions satisfied.'
    \else
      \echo 'FAIL: benchmark order results remain after reset.'
      \quit 1
    \endif
  \else
    \echo 'FAIL: benchmark orders remain after reset.'
    \quit 1
  \endif
\else
  \echo 'FAIL: product reset postcondition failed.'
  \quit 1
\endif
