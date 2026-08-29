#!/usr/bin/env bash
set -euo pipefail

capture_seconds="${CAPTURE_SECONDS:-45}"
capture_interval_seconds="${CAPTURE_INTERVAL_SECONDS:-5}"

[[ "$capture_seconds" =~ ^[0-9]+$ ]] && (( capture_seconds > 0 && capture_seconds <= 600 )) || {
  echo "CAPTURE_SECONDS must be an integer between 1 and 600." >&2
  exit 2
}
[[ "$capture_interval_seconds" =~ ^[0-9]+$ ]] && (( capture_interval_seconds > 0 )) || {
  echo "CAPTURE_INTERVAL_SECONDS must be a positive integer." >&2
  exit 2
}

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

printf 'classification=TARGET_VM_RESOURCE_EVIDENCE\n'
printf 'timestamp_start=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'commit=%s\n' "$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  printf 'dirty_state=dirty\n'
else
  printf 'dirty_state=clean\n'
fi
printf 'hostname=%s\n' "$(hostname)"
printf 'logical_cpus=%s\n' "$(getconf _NPROCESSORS_ONLN)"
if command -v free >/dev/null 2>&1; then
  free -h
elif [[ -r /proc/meminfo ]]; then
  awk '/^(MemTotal|MemAvailable|SwapTotal|SwapFree):/ {print}' /proc/meminfo
else
  printf 'memory_snapshot=unavailable_on_this_host\n'
fi
df -h .
docker compose ps

started_at=$(date +%s)
sample=0
while true; do
  now=$(date +%s)
  elapsed=$((now - started_at))
  if (( elapsed > capture_seconds )); then
    break
  fi

  sample=$((sample + 1))
  printf '\n=== sample=%s timestamp=%s elapsed_seconds=%s ===\n' \
    "$sample" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$elapsed"

  docker stats --no-stream --format \
    'container={{.Name}} cpu={{.CPUPerc}} memory={{.MemUsage}} memory_percent={{.MemPerc}} net={{.NetIO}} block={{.BlockIO}}'

  printf '%s\n' '-- PostgreSQL activity and lock waits --'
  docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-flashsale}" \
    -d "${POSTGRES_DB:-flashsale}" \
    -At -v ON_ERROR_STOP=1 \
    -c "SELECT 'connections total=' || COUNT(*) || ' active=' || COUNT(*) FILTER (WHERE state = 'active') || ' waiting=' || COUNT(*) FILTER (WHERE wait_event IS NOT NULL) FROM pg_stat_activity WHERE datname = current_database(); SELECT 'ungranted_locks=' || COUNT(*) FROM pg_locks WHERE NOT granted;"

  printf '%s\n' '-- Redis operations/cache counters --'
  for redis_service in redis-ops redis-cache; do
    printf 'service=%s ' "$redis_service"
    docker compose exec -T "$redis_service" redis-cli INFO stats | \
      tr -d '\r' | \
      awk -F: '/^(instantaneous_ops_per_sec|total_commands_processed|keyspace_hits|keyspace_misses):/ {printf "%s=%s ", $1, $2} END {print ""}'
  done

  printf '%s\n' '-- Application metrics --'
  for service in api-1 api-2 api-3 worker; do
    port=3000
    if [[ "$service" == "worker" ]]; then
      port=9464
    fi
    printf 'service=%s\n' "$service"
    docker compose exec -T prometheus wget -qO- "http://$service:$port/metrics" | \
      awk '/^(flash_sale_http_requests_total|flash_sale_http_request_duration_seconds_(count|sum)|flash_sale_product_cache_requests_total|flash_sale_product_cache_fills_total|flash_sale_queue_jobs|flash_sale_worker_jobs_total|flash_sale_worker_queue_jobs|flash_sale_worker_batch_duration_seconds_(count|sum)|flash_sale_(api|worker)_process_(resident_memory_bytes|cpu_seconds_total))(\{| )/ {print}'
  done

  if (( elapsed + capture_interval_seconds > capture_seconds )); then
    break
  fi
  sleep "$capture_interval_seconds"
done

printf '\ntimestamp_end=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'samples=%s\n' "$sample"
