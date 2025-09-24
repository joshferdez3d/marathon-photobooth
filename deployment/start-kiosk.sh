#!/bin/bash
# Usage: ./start-kiosk.sh [kiosk-number]

KIOSK_ID="kiosk-${1:-1}"
BACKEND_URL="http://192.168.1.100:3001"
FRONTEND_PORT=$((3000 + ${1:-1}))

echo "Starting $KIOSK_ID on port $FRONTEND_PORT"

# Kill any existing instance
pkill -f "kiosk=$KIOSK_ID"

# Start frontend with kiosk ID
cd ../frontend
REACT_APP_API_URL=$BACKEND_URL \
REACT_APP_KIOSK_ID=$KIOSK_ID \
PORT=$FRONTEND_PORT \
npm start &

sleep 5

# Launch Chrome in kiosk mode
google-chrome \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --app="http://localhost:$FRONTEND_PORT?kiosk=$KIOSK_ID" &