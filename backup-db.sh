#!/bin/bash
#
# MongoDB backup for the `cv` database (profile, positionings, email_opens).
#
# Small database — ~126 documents, well under 1 MB — but none of it is
# reproducible from this repo: `profile` and `positionings` are hand-authored
# content, and `email_opens` is accumulated tracking data that cannot be
# regenerated once lost.
#
# NOTE: unlike the hope and avis projects, this one has no MONGODB_DB in
# .env.local — the database name is hardcoded in the app at lib/db.ts
# (`client.db("cv")`). It is therefore hardcoded here too. If lib/db.ts ever
# changes database, change DB_NAME below to match.
#
# ─── RESTORE ─────────────────────────────────────────────────────────────────
#
# Full restore, overwriting the live database (DESTRUCTIVE — --drop replaces
# each collection in the archive as it is restored):
#
#   MONGODB_URI=$(sed -n 's/^MONGODB_URI=//p' .env.local | head -1 | tr -d '"')
#   mongorestore --uri="$MONGODB_URI" --gzip --drop \
#     --archive=~/backups/cv-db-YYYYMMDD-HHMMSS.archive.gz
#
# Safer: restore into a scratch database, then copy out only what you need.
# This never touches the live `cv` database:
#
#   mongorestore --uri="$MONGODB_URI" --gzip \
#     --archive=~/backups/cv-db-YYYYMMDD-HHMMSS.archive.gz \
#     --nsFrom='cv.*' --nsTo='cv_restore.*'
#
#   # then, e.g. recover the profile document:
#   mongosh "$MONGODB_URI" --eval '
#     const doc = db.getSiblingDB("cv_restore").profile.findOne();
#     db.getSiblingDB("cv").profile.replaceOne({ _id: doc._id }, doc, { upsert: true });
#   '
#
#   # clean up when done:
#   mongosh "$MONGODB_URI" --eval 'db.getSiblingDB("cv_restore").dropDatabase()'
#
# Inspect an archive without restoring anything (--dryRun prints "found
# collection …", not "restoring …" — grepping for the latter matches nothing):
#
#   mongorestore --gzip --archive=<file> --dryRun -v 2>&1 | grep 'found collection'
#
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_DIR/.env.local"
DEST_DIR="$HOME/backups"
PREFIX="cv-db"
KEEP=14

# Hardcoded because this project has no MONGODB_DB env var — see note above.
DB_NAME="cv"

# Read the URI without sourcing .env.local — sourcing would execute whatever is
# in that file, and it is not a shell script.
read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | head -1 | sed 's/^["'\'']//; s/["'\'']$//'
}

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found — cannot read the connection string." >&2
  exit 1
fi

if ! command -v mongodump >/dev/null 2>&1; then
  echo "✗ mongodump not found. Install the MongoDB Database Tools:" >&2
  echo "    https://www.mongodb.com/docs/database-tools/installation/" >&2
  exit 1
fi

MONGODB_URI="$(read_env MONGODB_URI)"

if [ -z "$MONGODB_URI" ]; then
  echo "✗ MONGODB_URI missing from $ENV_FILE — refusing to run." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$DEST_DIR/$PREFIX-$STAMP.archive.gz"

echo "→ [$(date '+%Y-%m-%d %H:%M:%S')] Dumping database '$DB_NAME' …"

# mongodump's progress/error output is deliberately NOT suppressed with
# --quiet: when a run fails, the reason has to reach the log, or the log is
# useless. The extra progress lines are worth it.
#
# Note: the URI carries inline credentials and mongodump only accepts it as an
# argument, so it is briefly visible in `ps` output to other users on this
# machine. Accepted tradeoff on a single-user desktop.
if ! mongodump \
  --uri="$MONGODB_URI" \
  --db="$DB_NAME" \
  --archive="$ARCHIVE" \
  --gzip; then
  echo "✗ mongodump failed — no usable backup was written." >&2
  rm -f "$ARCHIVE"
  exit 1
fi

# A mongodump that exits 0 but leaves a truncated or empty file is the classic
# silent backup failure. Verify the archive is real before trusting it.
if [ ! -s "$ARCHIVE" ]; then
  echo "✗ Archive is empty — treating as a failed backup." >&2
  rm -f "$ARCHIVE"
  exit 1
fi

if ! gzip -t "$ARCHIVE" 2>/dev/null; then
  echo "✗ Archive failed a gzip integrity check — treating as a failed backup." >&2
  rm -f "$ARCHIVE"
  exit 1
fi

echo "✓ Backup: $ARCHIVE"
ls -lh "$ARCHIVE" | awk '{print "  size: " $5}'

# ─── Prune, keeping the newest $KEEP archives ────────────────────────────────
mapfile -t OLD < <(ls -1t "$DEST_DIR/$PREFIX-"*.archive.gz 2>/dev/null | tail -n +$((KEEP + 1)))
if [ ${#OLD[@]} -gt 0 ]; then
  for f in "${OLD[@]}"; do
    rm -f "$f"
    echo "  pruned: $(basename "$f")"
  done
fi

COUNT="$(ls -1 "$DEST_DIR/$PREFIX-"*.archive.gz 2>/dev/null | wc -l)"
echo "  $COUNT snapshot(s) retained (keeping newest $KEEP)"
