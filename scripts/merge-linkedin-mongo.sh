#!/usr/bin/env bash
set -euo pipefail

DB="linkedin_scrapper"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TEMP_SOURCE="linkedin-mongo-migrate"
COUNT_JS="const d = db.getSiblingDB('${DB}'); print(JSON.stringify(d.getCollectionNames().sort().map(c => [c, d.getCollection(c).countDocuments({})])))"

say() { printf '%s\n' "$*"; }
fail() { printf 'STOP: %s\n' "$*" >&2; exit 1; }

container_for() {
	docker ps --filter "label=com.docker.compose.service=$1" --format '{{.Names}}' | head -n 1
}

counts() {
	docker exec "$1" mongosh --quiet --eval "$COUNT_JS"
}

wait_ready() {
	for _ in $(seq 1 30); do
		if docker exec "$1" mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
			return 0
		fi
		sleep 2
	done
	fail "$1 did not start."
}

cleanup() {
	if docker ps --format '{{.Names}}' | grep -qx "$TEMP_SOURCE"; then
		docker stop "$TEMP_SOURCE" >/dev/null
	fi
}
trap cleanup EXIT

TARGET="$(container_for outreach-mongo)"
[ -n "$TARGET" ] || fail "The outreach-mongo container is not running. Start it first: docker compose up -d outreach-mongo"

SOURCE="$(container_for linkedin-mongo)"
if [ -z "$SOURCE" ]; then
	VOLUME="$(docker volume ls --format '{{.Name}}' | grep -E '(^|_)linkedin-mongo$' | head -n 1 || true)"
	[ -n "$VOLUME" ] || fail "No linkedin-mongo container and no linkedin-mongo volume. There is nothing to move."
	say "Starting a temporary Mongo 7 on the old volume $VOLUME (read only use)."
	docker run -d --rm --name "$TEMP_SOURCE" -v "$VOLUME:/data/db" mongo:7 >/dev/null
	SOURCE="$TEMP_SOURCE"
fi
wait_ready "$SOURCE"
wait_ready "$TARGET"

SCRAPER="$(container_for linkedin-scraper)"
if [ -n "$SCRAPER" ]; then
	say "Stopping the LinkedIn scraper ($SCRAPER) so nothing is written during the copy."
	docker stop "$SCRAPER" >/dev/null
fi

BEFORE="$(counts "$SOURCE")"
AFTER_EXISTING="$(counts "$TARGET")"
say "Source ($SOURCE) $DB: $BEFORE"
say "Target ($TARGET) $DB: $AFTER_EXISTING"

if [ "$BEFORE" = "[]" ]; then
	say "The old database is empty. Nothing to move."
	exit 0
fi
if [ "$AFTER_EXISTING" = "$BEFORE" ]; then
	say "The shared Mongo already holds the same collections and counts. Nothing to do."
	exit 0
fi
[ "$AFTER_EXISTING" = "[]" ] || fail "The shared Mongo already has data in $DB that differs from the old one. Nothing was changed. Check it by hand before you run this again."

mkdir -p "$BACKUP_DIR"
ARCHIVE="$BACKUP_DIR/${DB}-$(date +%Y%m%d-%H%M%S).archive"
say "Dumping $DB to $ARCHIVE."
docker exec "$SOURCE" mongodump --quiet --db "$DB" --archive >"$ARCHIVE"
[ -s "$ARCHIVE" ] || fail "The dump is empty. Nothing was restored."

say "Restoring into $TARGET."
docker exec -i "$TARGET" mongorestore --quiet --archive --nsInclude "${DB}.*" <"$ARCHIVE"

AFTER="$(counts "$TARGET")"
say "Target after restore: $AFTER"
[ "$AFTER" = "$BEFORE" ] || fail "Counts differ after the restore. The old volume and $ARCHIVE are untouched. Do not switch yet."

say ""
say "Done. Every collection has the same number of documents in the shared Mongo."
say "The old linkedin-mongo volume is untouched. The backup is $ARCHIVE."
say "Next: put the new docker-compose.yml in place and run: docker compose up -d --remove-orphans"
