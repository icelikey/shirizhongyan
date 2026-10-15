#!/usr/bin/env bash
set -euo pipefail

# Build guard for the small single-instance deployment. It is intentionally
# read-only: it refuses a build before Docker can exhaust the host.
MIN_DISK_MB="${MIN_DISK_MB:-2048}"
MIN_MEM_MB="${MIN_MEM_MB:-1536}"
MIN_SWAP_MB="${MIN_SWAP_MB:-512}"

disk_kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
mem_kb="$(awk '/MemAvailable:/ { print $2 }' /proc/meminfo)"
swap_kb="$(awk '/SwapTotal:/ { print $2 }' /proc/meminfo)"

disk_mb=$((disk_kb / 1024))
mem_mb=$((mem_kb / 1024))
swap_mb=$((swap_kb / 1024))

printf 'root_available_mb=%s\n' "$disk_mb"
printf 'memory_available_mb=%s\n' "$mem_mb"
printf 'swap_total_mb=%s\n' "$swap_mb"

fail=0
if (( disk_mb < MIN_DISK_MB )); then
  printf 'resource_guard_failed=disk (need >= %s MB)\n' "$MIN_DISK_MB" >&2
  fail=1
fi
if (( mem_mb < MIN_MEM_MB )); then
  printf 'resource_guard_failed=memory (need >= %s MB)\n' "$MIN_MEM_MB" >&2
  fail=1
fi
if (( swap_mb < MIN_SWAP_MB )); then
  printf 'resource_guard_failed=swap (need >= %s MB)\n' "$MIN_SWAP_MB" >&2
  fail=1
fi

if (( fail != 0 )); then
  printf '%s\n' 'Do not run docker compose build on this host until resources are recovered.' >&2
  exit 2
fi

docker info >/dev/null
docker compose version >/dev/null
printf '%s\n' 'resource_guard=pass'
