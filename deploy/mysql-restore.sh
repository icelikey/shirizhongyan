#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${TDG_ENV_FILE:-$repo_root/deploy/.env.cloud}"
compose_file="${TDG_COMPOSE_FILE:-$repo_root/docker-compose.cloud.yml}"
input="${1:-}"

if [[ "${TDG_CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "set TDG_CONFIRM_RESTORE=YES to restore a database" >&2
  exit 2
fi
if [[ ! -f "$env_file" ]]; then
  echo "missing env file: $env_file" >&2
  exit 2
fi
if [[ -z "$input" || ! -f "$input" ]]; then
  echo "usage: TDG_CONFIRM_RESTORE=YES $0 <backup.sql.gz>" >&2
  exit 2
fi

if [[ -f "$input.sha256" ]]; then
  sha256sum --check "$input.sha256"
fi

gzip -dc "$input" | docker compose --env-file "$env_file" -f "$compose_file" exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

echo "restore_completed=$input"
