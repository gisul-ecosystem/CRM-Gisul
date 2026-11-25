#!/bin/sh
set -e

export DISPLAY="${DISPLAY:-:99}"

SLOTS="${LINKEDIN_BROWSER_SLOTS:-3}"
case "$SLOTS" in
  ''|*[!0-9]*) SLOTS=3 ;;
esac
[ "$SLOTS" -lt 1 ] && SLOTS=1
[ "$SLOTS" -gt 6 ] && SLOTS=6

FIRST_DISPLAY=99
FIRST_VNC=5900
FIRST_VIEWER=6080
NOVNC_WEB=/usr/share/novnc

start_slot() {
  i="$1"
  display=":$((FIRST_DISPLAY + i))"
  vnc=$((FIRST_VNC + i))
  viewer=$((FIRST_VIEWER + i))

  if ! pgrep -f "Xvfb $display " >/dev/null 2>&1; then
    Xvfb "$display" -screen 0 1440x900x24 -ac +extension GLX +render -noreset >"/tmp/xvfb-$i.log" 2>&1 &
    sleep 1
  fi

  if command -v xsetroot >/dev/null 2>&1; then
    DISPLAY="$display" xsetroot -solid '#2f343f' || true
  fi

  if command -v fluxbox >/dev/null 2>&1; then
    DISPLAY="$display" fluxbox >"/tmp/fluxbox-$i.log" 2>&1 &
  fi

  if command -v x11vnc >/dev/null 2>&1; then
    x11vnc -display "$display" -forever -shared -nopw -xkb -noxdamage \
      -wait 10 -defer 10 -rfbport "$vnc" -localhost \
      -o "/tmp/x11vnc-$i.log" >"/tmp/x11vnc-$i.out" 2>&1 &
  fi

  if command -v websockify >/dev/null 2>&1 && [ -d "$NOVNC_WEB" ]; then
    if [ "$i" -eq 0 ]; then
      websockify --web="$NOVNC_WEB" "0.0.0.0:$viewer" "localhost:$vnc" >"/tmp/novnc-$i.log" 2>&1 &
    else
      websockify "127.0.0.1:$viewer" "localhost:$vnc" >"/tmp/novnc-$i.log" 2>&1 &
    fi
  fi

  echo "[docker] browser slot $i: display $display, VNC $vnc, viewer $viewer"
}

start_vnc() {
  pkill -f 'websockify' >/dev/null 2>&1 || true
  pkill -x x11vnc >/dev/null 2>&1 || true
  pkill -x fluxbox >/dev/null 2>&1 || true
  pkill -x xmessage >/dev/null 2>&1 || true
  sleep 1

  mkdir -p /root/.fluxbox
  cat > /root/.fluxbox/init <<'EOF'
session.screen0.rootCommand: xsetroot -solid #2f343f
session.screen0.toolbar.visible: false
EOF

  i=0
  while [ "$i" -lt "$SLOTS" ]; do
    start_slot "$i"
    i=$((i + 1))
  done
  sleep 2
  pkill -x xmessage >/dev/null 2>&1 || true

  echo "[docker] $SLOTS LinkedIn browser slot(s). Each user's viewer opens through /vnc/ with a private link."
}

if [ -n "$DISPLAY" ]; then
  start_vnc
fi

echo "[docker] MONGODB_URI=$MONGODB_URI  PORT=$PORT"
exec "$@"
