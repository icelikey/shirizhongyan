#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${TDG_ENV_FILE:-$repo_root/deploy/.env.cloud}"
compose_file="${TDG_COMPOSE_FILE:-$repo_root/docker-compose.cloud.yml}"
backup_dir="${TDG_BACKUP_DIR:-$repo_root/backups}"

if [[ ! -f "$env_file" ]]; then
  echo "missing env file: $env_file" >&2
  exit 2
fi

mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$backup_dir/ten-days-gambit-$timestamp.sql.gz"

docker compose --env-file "$env_file" -f "$compose_file" exec -T mysql \
  sh -c 'exec mysqldump --single-transaction --routines --events --triggers -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip -9 > "$output"

if [[ ! -s "$output" ]]; then
  rm -f "$output"
  echo "backup is empty: $output" >&2
  exit 1
fi

sha256sum "$output" > "$output.sha256"
echo "backup_created=$output"
echo "checksum=$output.sha256"
