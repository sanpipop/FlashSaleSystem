#!/usr/bin/env sh
set -eu

product_id="${PRODUCT_ID:-p-1001}"
expected_stock="${EXPECTED_REMAINING_STOCK:-0}"
expected_successes="${EXPECTED_SUCCESSFUL_ORDERS:-50}"
expected_jobs="${EXPECTED_ACCEPTED_JOBS:-500}"
timeout_ms="${QUEUE_DRAIN_TIMEOUT_MS:-30000}"
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
support_mount="$repo_root/k6/support:/app/apps/worker/benchmark-support:ro"

queue_admin() {
  docker compose run --rm --no-deps \
    -v "$support_mount" \
    worker node /app/apps/worker/benchmark-support/queue-admin.mjs "$@"
}

echo "Waiting for BullMQ queue drain"
queue_admin wait-drain --timeout-ms "$timeout_ms"

echo "Verifying PostgreSQL stock/order/result invariants"
integrity_output=$(docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-flashsale}" \
  -d "${POSTGRES_DB:-flashsale}" \
  -v ON_ERROR_STOP=1 \
  -v product_id="$product_id" \
  -v expected_stock="$expected_stock" \
  -v expected_successes="$expected_successes" \
  -v expected_jobs="$expected_jobs" \
  -At \
  -f /dev/stdin < "$repo_root/k6/support/verify-integrity.sql")

printf '%s\n' "$integrity_output"
echo "Verifying every completed BullMQ job has a durable result"
queue_admin verify-durable --product "$product_id" --expected "$expected_jobs"

if [ "${VERIFY_RETRY_IDEMPOTENCY:-1}" = "1" ]; then
  echo "Replaying one committed successful job to prove retry idempotency"
  queue_admin retry-proof --product "$product_id" --timeout-ms "$timeout_ms"
fi

echo "PASS: all mandatory Day 4 integrity checks passed."
