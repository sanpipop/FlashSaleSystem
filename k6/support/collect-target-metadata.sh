#!/usr/bin/env sh
set -eu

target_repo_dir=${1:-}
case "$target_repo_dir" in
  /*) ;;
  *)
    echo "Target repository path must be absolute." >&2
    exit 2
    ;;
esac

cd "$target_repo_dir"

target_commit_sha=$(git rev-parse HEAD)
if [ -n "$(git status --porcelain)" ]; then
  target_dirty_state=dirty
else
  target_dirty_state=clean
fi
target_hostname=$(hostname)
target_cpu=$(awk -F: '
  /^model name[[:space:]]*:/ {
    value=$2
    sub(/^[[:space:]]+/, "", value)
    print value
    exit
  }
' /proc/cpuinfo)
if [ -z "$target_cpu" ]; then
  target_cpu=$(uname -m)
fi
target_logical_cpu_count=$(getconf _NPROCESSORS_ONLN)
target_ram_bytes=$(awk '/^MemTotal:/ { printf "%.0f", $2 * 1024 }' /proc/meminfo)
target_kernel=$(uname -srmo)
if [ -r /etc/os-release ]; then
  target_os=$(
    . /etc/os-release
    printf '%s' "${PRETTY_NAME:-${NAME:-unknown}}"
  )
else
  target_os=unknown
fi
target_docker_version=$(docker --version 2>/dev/null || printf unavailable)
target_compose_version=$(docker compose version 2>/dev/null || printf unavailable)

printf 'targetCommitSha=%s\n' "$target_commit_sha"
printf 'targetDirtyState=%s\n' "$target_dirty_state"
printf 'targetHostname=%s\n' "$target_hostname"
printf 'targetCpu=%s\n' "$target_cpu"
printf 'targetLogicalCpuCount=%s\n' "$target_logical_cpu_count"
printf 'targetRamBytes=%s\n' "$target_ram_bytes"
printf 'targetKernel=%s\n' "$target_kernel"
printf 'targetOs=%s\n' "$target_os"
printf 'targetDockerVersion=%s\n' "$target_docker_version"
printf 'targetComposeVersion=%s\n' "$target_compose_version"
