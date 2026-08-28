#!/usr/bin/env sh
set -eu

product_id="${PRODUCT_ID:-p-1001}"
expected_stock="${RESET_STOCK:-50}"
timeout_ms="${QUEUE_DRAIN_TIMEOUT_MS:-30000}"
cache_state="${CACHE_STATE:-cold}"
base_url="${BASE_URL:-http://localhost}"
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
support_mount="$repo_root/k6/support:/app/apps/worker/benchmark-support:ro"

if [ "${CONFIRM_BENCHMARK_RESET:-}" != "YES" ]; then
  echo "FAIL: set CONFIRM_BENCHMARK_RESET=YES to reset benchmark state for $product_id." >&2
  exit 2
fi

case "$product_id" in
  *[!A-Za-z0-9_-]*|'')
    echo "FAIL: PRODUCT_ID contains unsupported characters." >&2
    exit 2
    ;;
esac

case "$expected_stock" in
  *[!0-9]*|'')
    echo "FAIL: RESET_STOCK must be a non-negative integer." >&2
    exit 2
    ;;
esac

case "$cache_state" in
  cold|warm) ;;
  *)
    echo "FAIL: CACHE_STATE must be cold or warm." >&2
    exit 2
    ;;
esac

queue_admin() {
  docker compose run --rm --no-deps \
    -v "$support_mount" \
    worker node /app/apps/worker/benchmark-support/queue-admin.mjs "$@"
}

worker_stopped=0
edge_stopped=0
cleanup() {
  if [ "$worker_stopped" -eq 1 ]; then
    docker compose up -d --wait worker >/dev/null
  fi
  queue_admin resume >/dev/null 2>&1 || true
  if [ "$edge_stopped" -eq 1 ]; then
    docker compose up -d --wait nginx >/dev/null
  fi
}
trap cleanup EXIT INT TERM

echo "Stopping the public edge to prevent new admissions during reset"
docker compose stop nginx >/dev/null
edge_stopped=1

echo "Pausing BullMQ admission and waiting for active jobs"
queue_admin pause-and-drain-active --timeout-ms "$timeout_ms"

echo "Stopping Worker before queue/database reset"
docker compose stop worker >/dev/null
worker_stopped=1

echo "Resetting BullMQ through its public API"
queue_admin reset-queue

echo "Clearing only validated order claims for $product_id"
queue_admin clear-claims --product "$product_id"

echo "Resetting PostgreSQL benchmark state for $product_id"
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-flashsale}" \
  -d "${POSTGRES_DB:-flashsale}" \
  -v ON_ERROR_STOP=1 \
  -v product_id="$product_id" \
  -v reset_stock="$expected_stock" \
  -f /dev/stdin < "$repo_root/k6/support/reset-state.sql"

echo "Clearing the isolated volatile Redis Cache database"
docker compose exec -T redis-cache redis-cli FLUSHDB ASYNC >/dev/null

echo "Starting Worker and waiting for readiness"
docker compose up -d --wait worker >/dev/null
worker_stopped=0

echo "Starting the public edge after deterministic state is ready"
docker compose up -d --wait nginx >/dev/null
edge_stopped=0

if [ "$cache_state" = "warm" ]; then
  echo "Warming the exact products page outside the measured workload"
  curl --fail --silent --show-error \
    "$base_url/api/v1/products?page=1&limit=10" >/dev/null
fi

echo "Verifying deterministic reset postconditions"
queue_admin wait-drain --timeout-ms "$timeout_ms"
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-flashsale}" \
  -d "${POSTGRES_DB:-flashsale}" \
  -v ON_ERROR_STOP=1 \
  -v product_id="$product_id" \
  -v reset_stock="$expected_stock" \
  -f /dev/stdin < "$repo_root/k6/support/verify-reset.sql"

echo "PASS: benchmark state reset for $product_id with stock $expected_stock and cache $cache_state."
