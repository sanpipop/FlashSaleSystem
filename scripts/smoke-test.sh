#!/usr/bin/env sh
set -eu

base_url="${BASE_URL:-http://localhost}"

echo "Checking Nginx -> API health distribution"
i=1
while [ "$i" -le 6 ]; do
  curl --fail --silent --show-error "$base_url/health"
  echo
  i=$((i + 1))
done

echo "Checking seeded competition product"
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-flashsale}" \
  -d "${POSTGRES_DB:-flashsale}" \
  -c "SELECT product_id, name, remaining_stock FROM products WHERE product_id = 'p-1001';"

echo "Checking isolated Redis instances"
docker compose exec -T redis-ops redis-cli ping
docker compose exec -T redis-cache redis-cli ping

echo "Checking public API, metrics, and Bull Board"
curl --fail --silent --show-error "$base_url/api/v1/products?page=1&limit=10" >/dev/null
curl --fail --silent --show-error "$base_url/metrics" | grep 'flash_sale_http_requests_total' >/dev/null
curl --fail --silent --show-error --location "$base_url/admin/queues/" | grep -i 'Bull Dashboard' >/dev/null

echo "Checking database integrity gates"
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-flashsale}" \
  -d "${POSTGRES_DB:-flashsale}" \
  -v ON_ERROR_STOP=1 \
  -f /dev/stdin < scripts/verify-integrity.sql

echo "Smoke test passed"
