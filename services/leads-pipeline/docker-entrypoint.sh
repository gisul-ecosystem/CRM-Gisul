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
start_viewer() {
    Xvfb :99 -screen 0 1440x900x24 -ac -noreset >/tmp/xvfb.log 2>&1 &
    sleep 1
    mkdir -p "$HOME/.fluxbox"
    printf 'session.screen0.toolbar.visible: false\n' > "$HOME/.fluxbox/init"
    fluxbox >/tmp/fluxbox.log 2>&1 &
    x11vnc -display :99 -forever -shared -nopw -xkb -noxdamage -rfbport 5900 -localhost \
        -o /tmp/x11vnc.log >/tmp/x11vnc.out 2>&1 &
    websockify --web=/usr/share/novnc 0.0.0.0:6080 localhost:5900 >/tmp/novnc.log 2>&1 &
    echo "browser viewer on port 6080 (vnc_lite.html), display $DISPLAY"
}
if [ "$1" = "web" ] && [ -n "$DISPLAY" ] && command -v Xvfb >/dev/null 2>&1; then
    start_viewer
fi
case "$1" in
    web) exec python -m leads.web ;;          # API for the CRM + daily schedule (default)
    *)   exec python -m leads "$@" ;;         # e.g.  docker compose run --rm leads-pipeline run --batch 20
esac
