#!/bin/bash

# StreamIt Media Server + Cloudflare Tunnel Launcher
# Run this on your Mac to expose local movies to the deployed Vercel site.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
PORT=4000

echo "=== StreamIt Media Server ==="
echo ""

# Start the Express media server
echo "[1/2] Starting media server on port $PORT..."
node "$SERVER_DIR/index.js" &
SERVER_PID=$!
sleep 2

if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "ERROR: Media server failed to start."
  exit 1
fi
echo "  Media server running (PID: $SERVER_PID)"

# Start Cloudflare Tunnel
echo "[2/2] Starting Cloudflare Tunnel..."
echo "  (This gives you a public URL for your media server)"
echo ""
cloudflared tunnel --protocol http1.1 --url http://localhost:$PORT 2>&1 &
TUNNEL_PID=$!
sleep 5

echo ""
echo "============================================"
echo "  Both services are running!"
echo ""
echo "  IMPORTANT: Copy the https://*.trycloudflare.com"
echo "  URL printed above and set it as"
echo "  VITE_MEDIA_SERVER_URL in your Vercel"
echo "  environment variables."
echo ""
echo "  Press Ctrl+C to stop both services."
echo "============================================"

# Wait and clean up on exit
trap "echo 'Shutting down...'; kill $SERVER_PID $TUNNEL_PID 2>/dev/null; exit" INT TERM
wait
