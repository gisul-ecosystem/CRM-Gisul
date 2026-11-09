#!/bin/sh
# First start: create the settings file in the data volume, pointed at the Reacher container
# and with the daily run at 02:00 (there is no cron inside the container).
set -e
if [ ! -f "$ENV_FILE" ]; then
    mkdir -p "$(dirname "$ENV_FILE")"
    sed -e "s|^REACHER_URL=.*|REACHER_URL=${REACHER_URL:-http://leads-reacher:8080/v0/check_email}|" \
        -e 's|^RUN_AT=.*|RUN_AT=02:00|' /app/.env.example > "$ENV_FILE"
    echo "created $ENV_FILE: set USER_AGENT and the API keys in the CRM: Lead generation, Settings"
fi
for profile in training competitors; do
    target="$(dirname "$ENV_FILE")/.env.$profile"
    if [ ! -f "$target" ]; then
        cp "/app/.env.$profile.example" "$target"
        echo "created $target"
    fi
done
case "$1" in
    web) exec python -m leads.web ;;          # API for the CRM + daily schedule (default)
    *)   exec python -m leads "$@" ;;         # e.g.  docker compose run --rm leads-pipeline run --batch 20
esac
