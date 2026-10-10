#!/bin/bash
# Start Graveyard Escape so you can play on this Mac and on the iPhone.
#   ./play.sh          (port 8080)
#   ./play.sh 9000     (another port)
cd "$(dirname "$0")"
PORT="${1:-8080}"
PY="$HOME/.local/bin/python3.12"
[ -x "$PY" ] || PY="python3"

LAN=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
TSIP=$(/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null | head -1)

echo "🎃 Graveyard Escape is running!"
echo "   On this Mac:         http://localhost:$PORT"
echo "   iPhone (same Wi-Fi): http://$(scutil --get LocalHostName).local:$PORT   (QR code: open phone.html)"
[ -n "$LAN" ]  && echo "   iPhone (by IP):      http://$LAN:$PORT"
[ -n "$TSIP" ] && echo "   iPhone (Tailscale):  http://$TSIP:$PORT"
echo "   On iPhone: open in Safari → Share → Add to Home Screen"
if /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "(It's already running in the background, so just open one of those addresses.)"
  exit 0
fi
echo "Press Ctrl+C to stop."
exec "$PY" serve.py "$PORT"
