#!/usr/bin/env bash
# Ayurlahi database backup script.
#
# Usage:
#   ./scripts/backup-db.sh                 # one-shot backup
#   ./scripts/backup-db.sh --restore FILE  # restore from a .sql.gz file
#
# Required env vars (or set in .env):
#   DATABASE_URL  — postgres://user:pass@host:port/dbname
#          OR
#   DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
#
# Optional env vars:
#   BACKUP_DIR        — where to write backups (default: /var/backups/ayurlahi)
#   S3_BUCKET         — if set, uploads backup to s3://$S3_BUCKET/backups/
#   BACKUP_RETAIN_DAYS— how many days of local backups to keep (default: 30)
#
# Add to crontab for nightly backups at 02:00:
#   0 2 * * * /path/to/ayurlahi-backend/scripts/backup-db.sh >> /var/log/ayurlahi-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ayurlahi}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="medilink_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

# ── Resolve connection params ────────────────────────────────────────────────
if [[ -n "${DATABASE_URL:-}" ]]; then
  PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  export PGPASSWORD
  PG_OPTS="$DATABASE_URL"
else
  export PGPASSWORD="${DB_PASSWORD:-}"
  PG_OPTS="-U ${DB_USERNAME:-sayedsuhailk} -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} ${DB_NAME:-medilink}"
fi

# ── Restore mode ─────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--restore" ]]; then
  RESTORE_FILE="${2:-}"
  if [[ -z "$RESTORE_FILE" || ! -f "$RESTORE_FILE" ]]; then
    echo "ERROR: provide a valid backup file: $0 --restore <file.sql.gz>" >&2
    exit 1
  fi
  echo "[$(date)] Restoring from $RESTORE_FILE …"
  gunzip -c "$RESTORE_FILE" | psql $PG_OPTS
  echo "[$(date)] Restore complete."
  exit 0
fi

# ── Backup mode ──────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup → $BACKUP_PATH"
pg_dump $PG_OPTS \
  --format=plain \
  --no-owner \
  --no-acl \
  --verbose \
  | gzip > "$BACKUP_PATH"

echo "[$(date)] Backup complete: $BACKUP_PATH ($(du -sh "$BACKUP_PATH" | cut -f1))"

# ── Upload to S3 ─────────────────────────────────────────────────────────────
if [[ -n "${S3_BUCKET:-}" ]]; then
  S3_KEY="backups/${FILENAME}"
  echo "[$(date)] Uploading to s3://${S3_BUCKET}/${S3_KEY} …"
  aws s3 cp "$BACKUP_PATH" "s3://${S3_BUCKET}/${S3_KEY}" --storage-class STANDARD_IA
  echo "[$(date)] Upload complete."
fi

# ── Prune old local backups ───────────────────────────────────────────────────
echo "[$(date)] Pruning backups older than ${RETAIN_DAYS} days …"
find "$BACKUP_DIR" -name "medilink_backup_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
echo "[$(date)] Prune done. Current backups:"
ls -lh "$BACKUP_DIR"/medilink_backup_*.sql.gz 2>/dev/null || echo "  (none)"
