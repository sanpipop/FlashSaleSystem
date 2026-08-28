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

assert_non_negative_integer() {
  label=$1
  value=$2
  case "$value" in
    ''|*[!0-9]*)
      echo "FAIL: PostgreSQL integrity output for $label is not a non-negative integer: '$value'." >&2
      exit 1
      ;;
  esac
}

assert_equal() {
  label=$1
  actual=$2
  expected=$3
  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL: PostgreSQL invariant '$label' expected=$expected actual=$actual." >&2
    exit 1
  fi
}

assert_non_negative_integer EXPECTED_REMAINING_STOCK "$expected_stock"
assert_non_negative_integer EXPECTED_SUCCESSFUL_ORDERS "$expected_successes"
assert_non_negative_integer EXPECTED_ACCEPTED_JOBS "$expected_jobs"

echo "Waiting for BullMQ queue drain"
queue_admin wait-drain --timeout-ms "$timeout_ms"

echo "Verifying PostgreSQL stock/order/result invariants"
integrity_output=$(docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-flashsale}" \
  -d "${POSTGRES_DB:-flashsale}" \
  -v ON_ERROR_STOP=1 \
  -v product_id="$product_id" \
  -At \
  -F '|' \
  -f /dev/stdin < "$repo_root/k6/support/verify-integrity.sql")

# Field order is defined by k6/support/verify-integrity.sql:
# product_rows|remaining_stock|successful_orders|distinct_successful_users|
# duplicate_successful_pairs|negative_stock_rows|orphan_success_results|durable_results
case "$integrity_output" in
  *"
"*)
    echo "FAIL: PostgreSQL integrity query returned more than one row." >&2
    exit 1
    ;;
esac

IFS='|' read -r product_rows remaining_stock successful_orders distinct_users \
  duplicate_pairs negative_stock_rows orphan_success_results durable_results extra_fields <<EOF
$integrity_output
EOF

if [ -n "${extra_fields:-}" ]; then
  echo "FAIL: PostgreSQL integrity query returned an unexpected field count." >&2
  exit 1
fi

assert_non_negative_integer product_rows "$product_rows"
assert_non_negative_integer remaining_stock "$remaining_stock"
assert_non_negative_integer successful_orders "$successful_orders"
assert_non_negative_integer distinct_users "$distinct_users"
assert_non_negative_integer duplicate_pairs "$duplicate_pairs"
assert_non_negative_integer negative_stock_rows "$negative_stock_rows"
assert_non_negative_integer orphan_success_results "$orphan_success_results"
assert_non_negative_integer durable_results "$durable_results"

printf '%s\n' \
  "PostgreSQL facts: productRows=$product_rows remainingStock=$remaining_stock successfulOrders=$successful_orders distinctUsers=$distinct_users duplicatePairs=$duplicate_pairs negativeStockRows=$negative_stock_rows orphanSuccessResults=$orphan_success_results durableResults=$durable_results"

assert_equal product_rows "$product_rows" 1
assert_equal remaining_stock "$remaining_stock" "$expected_stock"
assert_equal successful_orders "$successful_orders" "$expected_successes"
assert_equal distinct_successful_users "$distinct_users" "$expected_successes"
assert_equal duplicate_successful_pairs "$duplicate_pairs" 0
assert_equal negative_stock_rows "$negative_stock_rows" 0
assert_equal orphan_success_results "$orphan_success_results" 0
assert_equal durable_results "$durable_results" "$expected_jobs"
echo "PASS: PostgreSQL integrity conditions satisfied."

echo "Verifying every completed BullMQ job has a durable result"
queue_admin verify-durable --product "$product_id" --expected "$expected_jobs"

if [ "${VERIFY_RETRY_IDEMPOTENCY:-1}" = "1" ]; then
  echo "Replaying one committed successful job to prove retry idempotency"
  queue_admin retry-proof --product "$product_id" --timeout-ms "$timeout_ms"
fi

echo "PASS: all mandatory Day 4 integrity checks passed."
