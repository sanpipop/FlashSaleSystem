#!/usr/bin/env bash
# =============================================================================
# run-mixed-stress-NAC.sh — Mixed-load stress runner [NAC EDITION ⭐]
#
# NAC = Next-Gen Analytics & Cache-profiling
# Wrapper รอบ k6/LoadtestNAC.js — เพิ่ม env vars ใหม่:
#   ENABLE_HOT_KEY_TEST  HOT_KEY_VUS  HOT_KEY_DURATION
#   BODY_SAMPLE_RATE     QUEUE_METRICS_URL
#
# Artifact ถูกเก็บใน artifacts/day5/stress-nac/<RUN_ID>/
# (แยก directory จาก run-mixed-stress.sh เพื่อไม่ชนกัน)
#
# Usage:
#   BASE_URL=http://172.30.58.6 \
#   TARGET_SSH=admin@172.30.58.6 \
#   TARGET_REPO_DIR=/srv/project_backend/FlashSaleSystem \
#   CONFIRM_MIXED_STRESS_RUN=YES \
#   bash k6/run-mixed-stress-NAC.sh
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Required env vars (inherited from run-mixed-stress.sh)
# ---------------------------------------------------------------------------
: "${BASE_URL:?BASE_URL is required and must point to the target VM}"
: "${TARGET_SSH:?TARGET_SSH is required, for example benchmark-user@target-host}"
: "${TARGET_REPO_DIR:?TARGET_REPO_DIR is required and must be an absolute target path}"

[[ "${CONFIRM_MIXED_STRESS_RUN:-}" == 'YES' ]] || {
  echo 'Set CONFIRM_MIXED_STRESS_RUN=YES after resetting the benchmark-owned target state.' >&2
  exit 2
}

# ป้องกันยิงไปที่ localhost โดยไม่ตั้งใจ
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

# ---------------------------------------------------------------------------
# Standard workload parameters (same as run-mixed-stress.sh)
# ---------------------------------------------------------------------------
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
run_id=${RUN_ID:-nac-$(date -u +%Y%m%dT%H%M%SZ)}

# ---------------------------------------------------------------------------
# ⭐ NAC — New env vars (pass through to k6 with safe defaults)
# ---------------------------------------------------------------------------
enable_hot_key_test=${ENABLE_HOT_KEY_TEST:-false}
hot_key_vus=${HOT_KEY_VUS:-2000}
hot_key_duration=${HOT_KEY_DURATION:-10s}
body_sample_rate=${BODY_SAMPLE_RATE:-0.001}
queue_metrics_url=${QUEUE_METRICS_URL:-}

# ---------------------------------------------------------------------------
# Numeric validation
# ---------------------------------------------------------------------------
for numeric in read_vus write_vus write_iterations monitor_seconds monitor_interval queue_timeout_ms hot_key_vus; do
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
[[ "$enable_hot_key_test" =~ ^(true|false)$ ]] || {
  echo 'ENABLE_HOT_KEY_TEST must be "true" or "false".' >&2
  exit 2
}

# ---------------------------------------------------------------------------
# Tool checks (same as run-mixed-stress.sh)
# ---------------------------------------------------------------------------
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
command -v ssh  >/dev/null || { echo 'OpenSSH client is required.' >&2; exit 2; }
command -v tar  >/dev/null || { echo 'tar is required.' >&2; exit 2; }

# ---------------------------------------------------------------------------
# SSH config
# ---------------------------------------------------------------------------
ssh_args=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes)
if [[ -n "${TARGET_SSH_CONFIG_FILE:-}" ]]; then
  [[ -r "$TARGET_SSH_CONFIG_FILE" ]] || {
    echo 'TARGET_SSH_CONFIG_FILE must reference a readable file.' >&2
    exit 2
  }
  ssh_args=(-F "$TARGET_SSH_CONFIG_FILE" "${ssh_args[@]}")
fi

# ---------------------------------------------------------------------------
# ⭐ NAC — Artifact directory (stress-nac instead of stress)
# ---------------------------------------------------------------------------
artifact_dir="artifacts/day5/stress-nac/$run_id"
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

# ---------------------------------------------------------------------------
# Collect target metadata (SSH)
# ---------------------------------------------------------------------------
if ! ssh "${ssh_args[@]}" "$TARGET_SSH" sh -s -- "$TARGET_REPO_DIR" \
  < k6/support/collect-target-metadata.sh > "$target_metadata"; then
  echo 'Unable to collect target metadata.' >&2
  exit 2
fi
cp "$target_metadata" "$artifact_dir/target-environment.txt"

# ---------------------------------------------------------------------------
# Init metadata + export standard env vars
# ---------------------------------------------------------------------------
export RUN_ID="$run_id" K6_BIN="$k6_bin" READ_VUS="$read_vus" READ_DURATION="$read_duration"
export WRITE_VUS="$write_vus" WRITE_ITERATIONS="$write_iterations"
export WRITE_START_TIME="$write_start_time" WRITE_MAX_DURATION="$write_max_duration"
export TARGET_PRODUCT_ID="$product_id" MONITOR_SECONDS="$monitor_seconds"
export MONITOR_INTERVAL_SECONDS="$monitor_interval"
node k6/support/mixed-metadata.mjs start "$artifact_dir/metadata.json" "$target_metadata"

# ---------------------------------------------------------------------------
# Remote queue helpers
# ---------------------------------------------------------------------------
remote_queue() {
  local action=$1
  ssh "${ssh_args[@]}" "$TARGET_SSH" \
    "cd '$TARGET_REPO_DIR' && docker compose run --rm --no-deps -v '$TARGET_REPO_DIR/k6/support:/app/apps/worker/benchmark-support:ro' worker node /app/apps/worker/benchmark-support/queue-admin.mjs '$action' --timeout-ms '$queue_timeout_ms'"
}

remote_queue wait-drain > "$artifact_dir/queue-before.txt" 2>&1

# ---------------------------------------------------------------------------
# Precondition integrity check
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Remote monitor (background)
# ---------------------------------------------------------------------------
ssh "${ssh_args[@]}" "$TARGET_SSH" bash -s -- \
  "$TARGET_REPO_DIR" "$monitor_seconds" "$monitor_interval" \
  < k6/support/capture-mixed-target.sh > "$monitor_archive" \
  2> "$artifact_dir/monitor-stderr.txt" &
monitor_pid=$!

# ---------------------------------------------------------------------------
# ⭐ Run k6 with LoadtestNAC.js + NAC env vars
# ---------------------------------------------------------------------------
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
  -e ENABLE_HOT_KEY_TEST="$enable_hot_key_test" \
  -e HOT_KEY_VUS="$hot_key_vus" \
  -e HOT_KEY_DURATION="$hot_key_duration" \
  -e BODY_SAMPLE_RATE="$body_sample_rate" \
  -e QUEUE_METRICS_URL="$queue_metrics_url" \
  k6/LoadtestNAC.js 2>&1 | tee "$artifact_dir/k6-output.txt"
k6_exit=${PIPESTATUS[0]}
cp /proc/net/dev "$artifact_dir/load-generator-network-after.txt"

# ---------------------------------------------------------------------------
# Post-run: queue drain + integrity check
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# ⭐ NAC — Notes.md (updated header)
# ---------------------------------------------------------------------------
cat > "$artifact_dir/notes.md" <<EOF
# Mixed Stress Run Notes — NAC EDITION ⭐

- Classification: NAC (Next-Gen Analytics & Cache-profiling) mixed-load investigation
- Run ID: $run_id
- Script: k6/LoadtestNAC.js
- Read workload: $read_vus VUs for $read_duration
- Write workload: $write_vus VUs x $write_iterations sequential iterations
- Hot-key stress: enabled=$enable_hot_key_test (VUs=$hot_key_vus, Duration=$hot_key_duration)
- Body sample rate: $body_sample_rate
- No production tuning was applied by this wrapper.
- HTTP timeout values were not changed.

## NAC Features Enabled
- ⭐ B.1 Cache HIT/MISS/BYPASS observability (X-Cache-Status header)
- ⭐ B.2 TTFB breakdown: waiting / network transfer / connection setup
- ⭐ B.3 Hot-key contention scenario (ENABLE_HOT_KEY_TEST=$enable_hot_key_test)
- ⭐ B.4 Cache stampede detection (cold-start probe in setup)
- ⭐ B.5 Full percentiles: p50/p90/p95/p99/max
- ⭐ B.6 Write forensic tagging: timeout/connReset/504
- ⭐ B.7 Queue health probe in teardown
- ⭐ B.8 Response body sampling (BODY_SAMPLE_RATE=$body_sample_rate)
EOF

# ---------------------------------------------------------------------------
# Secret scan
# ---------------------------------------------------------------------------
secret_exit=0
if grep -rEl \
  'Bearer[[:space:]]+eyJ|"accessToken"[[:space:]]*:|BEGIN OPENSSH PRIVATE KEY|JWT_SECRET=|POSTGRES_PASSWORD=' \
  "$artifact_dir" > "$artifact_dir/secret-scan.txt" 2>/dev/null; then
  secret_exit=1
else
  printf 'PASS: no credential patterns found in run artifacts.\n' > "$artifact_dir/secret-scan.txt"
fi

# ---------------------------------------------------------------------------
# Finalize metadata
# ---------------------------------------------------------------------------
node k6/support/mixed-metadata.mjs finish \
  "$artifact_dir/metadata.json" "$summary_file" \
  "$k6_exit" "$queue_exit" "$integrity_exit" "$monitor_exit" "$secret_exit"

final_exit=0
for status in "$k6_exit" "$queue_exit" "$integrity_exit" "$monitor_exit" "$secret_exit"; do
  (( status == 0 )) || final_exit=1
done
echo "NAC stress evidence saved to $artifact_dir"
exit "$final_exit"
