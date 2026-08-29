#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL is required and must point to the target VM}"
: "${TARGET_SSH:?TARGET_SSH is required, for example benchmark-user@target-host}"
: "${TARGET_REPO_DIR:?TARGET_REPO_DIR is required and must be an absolute target path}"

[[ "${CONFIRM_MIXED_STRESS_RUN:-}" == 'YES' ]] || {
  echo 'Set CONFIRM_MIXED_STRESS_RUN=YES after resetting the benchmark-owned target state.' >&2
  exit 2
}
case "$BASE_URL" in
  http://localhost*|https://localhost*|http://127.*|https://127.*)
    echo 'Mixed stress must run from an external load generator against the target VM.' >&2
    exit 2
    ;;
esac
[[ "$TARGET_SSH" =~ ^[A-Za-z0-9._-]+@[A-Za-z0-9.:-]+$ ]] || {
  echo 'TARGET_SSH must use user@host form.' >&2
  exit 2
}
[[ "$TARGET_REPO_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]] || {
  echo 'TARGET_REPO_DIR must be an absolute safe path.' >&2
  exit 2
}

read_vus=${READ_VUS:-1000}
read_duration=${READ_DURATION:-30s}
write_vus=${WRITE_VUS:-500}
write_iterations=${WRITE_ITERATIONS:-3}
write_start_time=${WRITE_START_TIME:-10s}
write_max_duration=${WRITE_MAX_DURATION:-45s}
product_id=${TARGET_PRODUCT_ID:-p-1001}
monitor_seconds=${MONITOR_SECONDS:-75}
monitor_interval=${MONITOR_INTERVAL_SECONDS:-1}
queue_timeout_ms=${QUEUE_DRAIN_TIMEOUT_MS:-30000}
run_id=${RUN_ID:-mixed-1x-$(date -u +%Y%m%dT%H%M%SZ)}

for numeric in read_vus write_vus write_iterations monitor_seconds monitor_interval queue_timeout_ms; do
  value=${!numeric}
  [[ "$value" =~ ^[0-9]+$ ]] && (( value > 0 )) || {
    echo "$numeric must be a positive integer." >&2
    exit 2
  }
done
[[ "$run_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || {
  echo 'RUN_ID contains unsupported characters.' >&2
  exit 2
}
[[ "$product_id" =~ ^[A-Za-z0-9_-]+$ ]] || {
  echo 'TARGET_PRODUCT_ID contains unsupported characters.' >&2
  exit 2
}

k6_bin=${K6_BIN:-k6}
command -v "$k6_bin" >/dev/null || { echo 'k6 is not installed.' >&2; exit 2; }
k6_version_output=$("$k6_bin" version 2>&1)
k6_version_token=$(printf '%s\n' "$k6_version_output" | grep -oE 'v?[0-9]+\.[0-9]+\.[0-9]+' | head -1)
[[ "${k6_version_token#v}" == '2.2.0' ]] || {
  echo "Mixed stress requires k6 v2.2.0; got ${k6_version_token:-unknown}." >&2
  exit 2
}
[[ -x /usr/bin/time ]] && /usr/bin/time --version 2>&1 | grep -qi 'GNU.*time' || {
  echo 'GNU /usr/bin/time is required.' >&2
  exit 2
}
command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 2; }
command -v ssh >/dev/null || { echo 'OpenSSH client is required.' >&2; exit 2; }
command -v tar >/dev/null || { echo 'tar is required.' >&2; exit 2; }

ssh_args=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes)
if [[ -n "${TARGET_SSH_CONFIG_FILE:-}" ]]; then
  [[ -r "$TARGET_SSH_CONFIG_FILE" ]] || {
    echo 'TARGET_SSH_CONFIG_FILE must reference a readable file.' >&2
    exit 2
  }
  ssh_args=(-F "$TARGET_SSH_CONFIG_FILE" "${ssh_args[@]}")
fi

artifact_dir="artifacts/day5/stress/$run_id"
[[ ! -e "$artifact_dir" ]] || {
  echo "Refusing to overwrite existing evidence: $artifact_dir" >&2
  exit 2
}
mkdir -p "$artifact_dir"

target_metadata=$(mktemp)
monitor_archive="$artifact_dir/target-monitor.tar.gz"
cleanup() {
  rm -f "$target_metadata"
}
trap cleanup EXIT INT TERM

if ! ssh "${ssh_args[@]}" "$TARGET_SSH" sh -s -- "$TARGET_REPO_DIR" \
  < k6/support/collect-target-metadata.sh > "$target_metadata"; then
  echo 'Unable to collect target metadata.' >&2
  exit 2
fi
cp "$target_metadata" "$artifact_dir/target-environment.txt"

export RUN_ID="$run_id" K6_BIN="$k6_bin" READ_VUS="$read_vus" READ_DURATION="$read_duration"
export WRITE_VUS="$write_vus" WRITE_ITERATIONS="$write_iterations"
export WRITE_START_TIME="$write_start_time" WRITE_MAX_DURATION="$write_max_duration"
export TARGET_PRODUCT_ID="$product_id" MONITOR_SECONDS="$monitor_seconds"
export MONITOR_INTERVAL_SECONDS="$monitor_interval"
node k6/support/mixed-metadata.mjs start "$artifact_dir/metadata.json" "$target_metadata"

remote_queue() {
  local action=$1
  ssh "${ssh_args[@]}" "$TARGET_SSH" \
    "cd '$TARGET_REPO_DIR' && docker compose run --rm --no-deps -v '$TARGET_REPO_DIR/k6/support:/app/apps/worker/benchmark-support:ro' worker node /app/apps/worker/benchmark-support/queue-admin.mjs '$action' --timeout-ms '$queue_timeout_ms'"
}

remote_queue wait-drain > "$artifact_dir/queue-before.txt" 2>&1

expected_successes=$write_vus
(( expected_successes > 50 )) && expected_successes=50
expected_remaining=$((50 - expected_successes))
expected_jobs=$write_vus

set +e
ssh "${ssh_args[@]}" "$TARGET_SSH" \
  "cd '$TARGET_REPO_DIR' && EXPECTED_REMAINING_STOCK=50 EXPECTED_SUCCESSFUL_ORDERS=0 EXPECTED_ACCEPTED_JOBS=0 VERIFY_RETRY_IDEMPOTENCY=0 PRODUCT_ID='$product_id' sh scripts/verify-integrity.sh" \
  > "$artifact_dir/precondition-integrity.txt" 2>&1
precondition_exit=$?
set -e
if (( precondition_exit != 0 )); then
  node k6/support/mixed-metadata.mjs finish \
    "$artifact_dir/metadata.json" /dev/null \
    2 0 "$precondition_exit" 0 0
  echo "Target reset precondition failed; see $artifact_dir/precondition-integrity.txt" >&2
  exit 2
fi

ssh "${ssh_args[@]}" "$TARGET_SSH" bash -s -- \
  "$TARGET_REPO_DIR" "$monitor_seconds" "$monitor_interval" \
  < k6/support/capture-mixed-target.sh > "$monitor_archive" \
  2> "$artifact_dir/monitor-stderr.txt" &
monitor_pid=$!

resource_file="$artifact_dir/load-generator-resource.txt"
summary_file="$artifact_dir/k6-summary.json"
cp /proc/net/dev "$artifact_dir/load-generator-network-before.txt"
set +e
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
  /usr/bin/time -v -o "$resource_file" "$k6_bin" run \
  -e BASE_URL="$BASE_URL" \
  -e SUMMARY_PATH="$summary_file" \
  -e READ_VUS="$read_vus" \
  -e READ_DURATION="$read_duration" \
  -e WRITE_VUS="$write_vus" \
  -e WRITE_ITERATIONS="$write_iterations" \
  -e WRITE_START_TIME="$write_start_time" \
  -e WRITE_MAX_DURATION="$write_max_duration" \
  -e TARGET_PRODUCT_ID="$product_id" \
  k6/LoadtestO.js 2>&1 | tee "$artifact_dir/k6-output.txt"
k6_exit=${PIPESTATUS[0]}
cp /proc/net/dev "$artifact_dir/load-generator-network-after.txt"

remote_queue wait-drain > "$artifact_dir/queue-after.txt" 2>&1
queue_exit=$?

ssh "${ssh_args[@]}" "$TARGET_SSH" \
  "cd '$TARGET_REPO_DIR' && EXPECTED_REMAINING_STOCK='$expected_remaining' EXPECTED_SUCCESSFUL_ORDERS='$expected_successes' EXPECTED_ACCEPTED_JOBS='$expected_jobs' VERIFY_RETRY_IDEMPOTENCY=1 PRODUCT_ID='$product_id' sh scripts/verify-integrity.sh" \
  > "$artifact_dir/integrity.txt" 2>&1
integrity_exit=$?

wait "$monitor_pid"
monitor_exit=$?
set -e

if (( monitor_exit == 0 )); then
  tar -xzf "$monitor_archive" -C "$artifact_dir"
fi

cat > "$artifact_dir/notes.md" <<EOF
# Mixed Stress Run Notes

- Classification: non-official mixed-load root-cause investigation
- Run ID: $run_id
- Read workload: $read_vus VUs for $read_duration
- Write workload: $write_vus VUs x $write_iterations sequential iterations
- No production tuning was applied by this wrapper.
- HTTP timeout values were not changed.
EOF

secret_exit=0
if grep -rEl \
  'Bearer[[:space:]]+eyJ|"accessToken"[[:space:]]*:|BEGIN OPENSSH PRIVATE KEY|JWT_SECRET=|POSTGRES_PASSWORD=' \
  "$artifact_dir" > "$artifact_dir/secret-scan.txt" 2>/dev/null; then
  secret_exit=1
else
  printf 'PASS: no credential patterns found in run artifacts.\n' > "$artifact_dir/secret-scan.txt"
fi

node k6/support/mixed-metadata.mjs finish \
  "$artifact_dir/metadata.json" "$summary_file" \
  "$k6_exit" "$queue_exit" "$integrity_exit" "$monitor_exit" "$secret_exit"

final_exit=0
for status in "$k6_exit" "$queue_exit" "$integrity_exit" "$monitor_exit" "$secret_exit"; do
  (( status == 0 )) || final_exit=1
done
echo "Mixed stress evidence saved to $artifact_dir"
exit "$final_exit"
