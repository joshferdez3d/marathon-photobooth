#!/bin/bash
# Master script to start entire system

echo "🏃 Starting Amsterdam Marathon Photo Booth System"

# Start backend
echo "Starting backend server..."
cd ../backend
pm2 start ecosystem.config.js

# Wait for backend to be ready
sleep 5

# Start all 4 kiosks
for i in 1 2 3 4; do
  echo "Starting kiosk-$i..."
  ./start-kiosk.sh $i
  sleep 3
done

echo "✅ All systems started!"
echo "Monitor at: http://localhost:3001/api/monitor"