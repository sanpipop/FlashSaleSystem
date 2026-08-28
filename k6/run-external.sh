#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL is required and must point to the target VM}"
: "${TEST_PROFILE:?TEST_PROFILE is required: auth, read, write, or duplicate}"
: "${RUN_ID:?RUN_ID is required and must be unique}"
: "${TARGET_COMMIT_SHA:?TARGET_COMMIT_SHA is required for evidence provenance}"
: "${TARGET_DIRTY_STATE:?TARGET_DIRTY_STATE=clean is required for an official run}"
: "${TARGET_HOSTNAME:?TARGET_HOSTNAME is required for evidence provenance}"
: "${TARGET_CPU:?TARGET_CPU is required for evidence provenance}"
: "${TARGET_RAM:?TARGET_RAM is required for evidence provenance}"

[[ "$TARGET_COMMIT_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || {
  echo "TARGET_COMMIT_SHA must be the full 40-character commit SHA deployed on the VM." >&2
  exit 2
}
[[ "$TARGET_DIRTY_STATE" == "clean" ]] || {
  echo "Refusing an official run against a dirty target checkout." >&2
  exit 2
}

[[ "$RUN_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || {
  echo "RUN_ID must contain only letters, digits, dot, underscore, and hyphen." >&2
  exit 2
}

queue_timeout_ms="${QUEUE_DRAIN_TIMEOUT_MS:-30000}"
[[ "$queue_timeout_ms" =~ ^[0-9]+$ ]] && (( queue_timeout_ms > 0 )) || {
  echo "QUEUE_DRAIN_TIMEOUT_MS must be a positive integer." >&2
  exit 2
}

case "$BASE_URL" in
  http://localhost*|https://localhost*|http://127.*|https://127.*|http://\[::1\]*|https://\[::1\]*)
    echo "Refusing an official run against localhost. k6 must be external to the target VM." >&2
    exit 2
    ;;
esac

case "$TEST_PROFILE" in
  auth|read|write|duplicate) ;;
  *) echo "Unknown TEST_PROFILE: $TEST_PROFILE" >&2; exit 2 ;;
esac

if [[ "$TEST_PROFILE" == "read" ]]; then
  : "${CACHE_STATE:?CACHE_STATE=cold or warm is required for a read run}"
  [[ "$CACHE_STATE" == "cold" || "$CACHE_STATE" == "warm" ]] || {
    echo "CACHE_STATE must be cold or warm." >&2
    exit 2
  }
fi

k6_bin="${K6_BIN:-k6}"
command -v "$k6_bin" >/dev/null || {
  echo "k6 is not installed on this external load generator." >&2
  exit 2
}
command -v node >/dev/null || {
  echo "Node.js is required only for redacted metadata collection." >&2
  exit 2
}

artifact_dir="artifacts/day4/$RUN_ID"
if [[ -e "$artifact_dir" ]]; then
  echo "Refusing to overwrite existing evidence: $artifact_dir" >&2
  exit 2
fi
mkdir -p "$artifact_dir"

export K6_BIN="$k6_bin"
node k6/support/metadata.mjs start "$artifact_dir/metadata.json"

resource_file="$artifact_dir/load-generator-resource.txt"
if [[ -x /usr/bin/time ]]; then
  timed_command=(/usr/bin/time -v -o "$resource_file")
else
  timed_command=()
  printf '%s\n' 'GNU time unavailable; load-generator process CPU/RAM was not captured.' > "$resource_file"
fi

set +e
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  "${timed_command[@]}" "$k6_bin" run \
  -e BASE_URL="$BASE_URL" \
  -e TEST_PROFILE="$TEST_PROFILE" \
  -e SUMMARY_PATH="$artifact_dir/k6-summary.json" \
  -e READ_VUS="${READ_VUS:-1000}" \
  -e READ_DURATION="${READ_DURATION:-30s}" \
  -e WRITE_USERS="${WRITE_USERS:-500}" \
  -e DUPLICATE_USERS="${DUPLICATE_USERS:-50}" \
  -e PRODUCT_ID="${PRODUCT_ID:-p-1001}" \
  -e USER_PREFIX="${USER_PREFIX:-user}" \
  k6/competition.js 2>&1 | tee "$artifact_dir/k6-output.txt"
k6_exit=${PIPESTATUS[0]}
set -e

queue_exit=0
if [[ "$TEST_PROFILE" == "write" || "$TEST_PROFILE" == "duplicate" ]]; then
  queue_started_ms=$(date +%s%3N)
  queue_deadline_ms=$((queue_started_ms + queue_timeout_ms))
  : > "$artifact_dir/queue.txt"
  while true; do
    metrics=$(curl --noproxy '*' --fail --silent --show-error "$BASE_URL/metrics") || {
      echo 'Unable to read public queue metrics.' | tee -a "$artifact_dir/queue.txt"
      queue_exit=1
      break
    }
    waiting=$(printf '%s\n' "$metrics" | awk '/^flash_sale_queue_jobs\{.*state="waiting"/ {sum += $NF} END {print sum + 0}')
    active=$(printf '%s\n' "$metrics" | awk '/^flash_sale_queue_jobs\{.*state="active"/ {sum += $NF} END {print sum + 0}')
    delayed=$(printf '%s\n' "$metrics" | awk '/^flash_sale_queue_jobs\{.*state="delayed"/ {sum += $NF} END {print sum + 0}')
    failed=$(printf '%s\n' "$metrics" | awk '/^flash_sale_queue_jobs\{.*state="failed"/ {sum += $NF} END {print sum + 0}')
    now_ms=$(date +%s%3N)
    printf 'timestamp_ms=%s waiting=%s active=%s delayed=%s failed=%s\n' \
      "$now_ms" "$waiting" "$active" "$delayed" "$failed" >> "$artifact_dir/queue.txt"
    if [[ "$failed" != "0" ]]; then
      echo 'Queue reached a failed-job state.' | tee -a "$artifact_dir/queue.txt"
      queue_exit=1
      break
    fi
    if [[ "$waiting" == "0" && "$active" == "0" && "$delayed" == "0" ]]; then
      echo "queue_drain_ms=$((now_ms - queue_started_ms))" | tee -a "$artifact_dir/queue.txt"
      break
    fi
    if (( now_ms >= queue_deadline_ms )); then
      echo 'Queue did not drain within the configured timeout.' | tee -a "$artifact_dir/queue.txt"
      queue_exit=1
      break
    fi
    sleep 0.1
  done
fi

final_exit=$k6_exit
if [[ "$queue_exit" -ne 0 ]]; then
  final_exit=$queue_exit
fi
invalid_reason=''
if [[ "$queue_exit" -ne 0 ]]; then
  invalid_reason='queue failed or did not drain within the bounded timeout'
fi
node k6/support/metadata.mjs finish \
  "$artifact_dir/metadata.json" "$final_exit" "$invalid_reason"
echo "Evidence saved to $artifact_dir; copy target-resource.txt from the VM and run integrity verification before marking the run valid."
exit "$final_exit"
