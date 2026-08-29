#!/usr/bin/env bash
set -euo pipefail

target_repo_dir=${1:-}
capture_seconds=${2:-75}
capture_interval=${3:-1}

[[ "$target_repo_dir" =~ ^/[A-Za-z0-9._/-]+$ ]] || {
  echo 'Target repository path is invalid.' >&2
  exit 2
}
[[ "$capture_seconds" =~ ^[0-9]+$ ]] && (( capture_seconds >= 10 && capture_seconds <= 300 )) || {
  echo 'Capture duration must be between 10 and 300 seconds.' >&2
  exit 2
}
[[ "$capture_interval" =~ ^[0-9]+$ ]] && (( capture_interval >= 1 && capture_interval <= 10 )) || {
  echo 'Capture interval must be between 1 and 10 seconds.' >&2
  exit 2
}

cd "$target_repo_dir"
capture_dir=$(mktemp -d)
cleanup() {
  rm -rf -- "$capture_dir"
}
trap cleanup EXIT INT TERM

services=(nginx api-1 api-2 api-3 worker postgres redis-cache redis-ops)
start_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

monitored_ids=()
for service in "${services[@]}"; do
  id=$(docker compose ps -q "$service")
  [[ -z "$id" ]] || monitored_ids+=("$id")
done

snapshot() {
  local phase=$1
  local output=$2
  {
    printf 'phase=%s timestamp=%s\n' "$phase" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    hostname
    uptime
    free -b 2>/dev/null || awk '/^(MemTotal|MemAvailable|SwapTotal|SwapFree):/ {print}' /proc/meminfo
    docker compose ps
    local ids=()
    local service id
    for service in "${services[@]}"; do
      id=$(docker compose ps -q "$service")
      [[ -z "$id" ]] || ids+=("$id")
    done
    if (( ${#ids[@]} > 0 )); then
      docker stats --no-stream --format \
        'container={{.Name}} cpu={{.CPUPerc}} memory={{.MemUsage}} memory_percent={{.MemPerc}} net={{.NetIO}} block={{.BlockIO}} pids={{.PIDs}}' \
        "${ids[@]}"
    fi
  } > "$output"
}

cgroup_snapshot() {
  local phase=$1
  local output=$2
  : > "$output"
  local service id pid cgroup_path cpu_stat
  for service in "${services[@]}"; do
    id=$(docker compose ps -q "$service")
    [[ -n "$id" ]] || continue
    pid=$(docker inspect -f '{{.State.Pid}}' "$id")
    cgroup_path=$(awk -F: '$1 == "0" {print $3}' "/proc/$pid/cgroup" 2>/dev/null || true)
    cpu_stat="/sys/fs/cgroup${cgroup_path}/cpu.stat"
    printf 'phase=%s timestamp=%s service=%s container=%s pid=%s\n' \
      "$phase" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$service" "$id" "$pid" >> "$output"
    if [[ -r "$cpu_stat" ]]; then
      sed 's/^/  /' "$cpu_stat" >> "$output"
    else
      printf '  cpu.stat unavailable\n' >> "$output"
    fi
  done
}

snapshot before "$capture_dir/target-before.txt"
cgroup_snapshot before "$capture_dir/cgroup-before.txt"

if command -v vmstat >/dev/null 2>&1; then
  vmstat -w 1 "$((capture_seconds + 1))" > "$capture_dir/vmstat.txt" &
  vmstat_pid=$!
else
  printf 'vmstat unavailable\n' > "$capture_dir/vmstat.txt"
  vmstat_pid=''
fi

: > "$capture_dir/docker-stats.txt"
: > "$capture_dir/postgres-samples.txt"
: > "$capture_dir/redis-samples.txt"
: > "$capture_dir/bullmq-worker-samples.txt"

started_epoch=$(date +%s)
sample=0
while true; do
  now_epoch=$(date +%s)
  elapsed=$((now_epoch - started_epoch))
  (( elapsed <= capture_seconds )) || break
  sample=$((sample + 1))
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  if (( ${#monitored_ids[@]} > 0 )); then
    printf 'sample=%s timestamp=%s elapsed=%s\n' "$sample" "$timestamp" "$elapsed" \
      >> "$capture_dir/docker-stats.txt"
    docker stats --no-stream --format \
      'container={{.Name}} cpu={{.CPUPerc}} memory={{.MemUsage}} memory_percent={{.MemPerc}} net={{.NetIO}} block={{.BlockIO}} pids={{.PIDs}}' \
      "${monitored_ids[@]}" >> "$capture_dir/docker-stats.txt"
  fi

  if (( sample == 1 || sample % 2 == 0 )); then
    docker compose exec -T postgres psql \
      -U "${POSTGRES_USER:-flashsale}" \
      -d "${POSTGRES_DB:-flashsale}" -At -v ON_ERROR_STOP=1 \
      -c "SELECT '$timestamp|activity|' || COUNT(*) || '|' || COUNT(*) FILTER (WHERE state='active') || '|' || COUNT(*) FILTER (WHERE wait_event IS NOT NULL) || '|' || COALESCE(string_agg(DISTINCT COALESCE(wait_event_type,'none') || ':' || COALESCE(wait_event,'none'), ','), '') FROM pg_stat_activity; SELECT '$timestamp|ungranted_locks|' || COUNT(*) FROM pg_locks WHERE NOT granted;" \
      </dev/null >> "$capture_dir/postgres-samples.txt" 2>&1 || true

    for redis_service in redis-cache redis-ops; do
      printf 'timestamp=%s service=%s ' "$timestamp" "$redis_service" \
        >> "$capture_dir/redis-samples.txt"
      docker compose exec -T "$redis_service" redis-cli INFO </dev/null \
        | tr -d '\r' \
        | awk -F: '/^(connected_clients|blocked_clients|used_memory|evicted_keys|instantaneous_ops_per_sec):/ {printf "%s=%s ", $1, $2} END {print ""}' \
        >> "$capture_dir/redis-samples.txt" 2>&1 || true
    done

    printf 'timestamp=%s\n' "$timestamp" >> "$capture_dir/bullmq-worker-samples.txt"
    docker compose exec -T prometheus wget -qO- http://worker:9464/metrics </dev/null \
      | awk '/^(flash_sale_worker_queue_jobs|flash_sale_worker_jobs_total|flash_sale_worker_batch_duration_seconds_(count|sum)|flash_sale_worker_process_process_cpu_seconds_total|flash_sale_worker_process_process_resident_memory_bytes)(\{| )/ {print}' \
      >> "$capture_dir/bullmq-worker-samples.txt" 2>&1 || true
  fi

  (( elapsed + capture_interval <= capture_seconds )) || break
  sleep "$capture_interval"
done

if [[ -n "$vmstat_pid" ]]; then
  wait "$vmstat_pid" || true
fi

cgroup_snapshot after "$capture_dir/cgroup-after.txt"
snapshot after "$capture_dir/target-after.txt"
docker compose logs --since "$start_time" nginx > "$capture_dir/nginx-access.log" 2>&1 || true
docker compose exec -T nginx sh -c 'cat /var/log/nginx/error.log 2>/dev/null || true' </dev/null \
  > "$capture_dir/nginx-error.log" 2>&1 || true
printf 'timestamp_start=%s\ntimestamp_end=%s\nsamples=%s\ninterval_seconds=%s\n' \
  "$start_time" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$sample" "$capture_interval" \
  > "$capture_dir/monitor-metadata.txt"

tar -C "$capture_dir" -czf - .
