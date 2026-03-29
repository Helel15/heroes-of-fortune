#!/bin/bash
# Start Heroes of Fortune with Multiplayer Server

echo "🎮 Heroes of Fortune - Multiplayer Setup"
echo "========================================"
echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "Choose an option:"
echo "1. Start BOTH server and client (recommended)"
echo "2. Start only SERVER (port 5000)"
echo "3. Start only CLIENT (port 5173)"
echo ""
read -p "Enter choice (1-3): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "🚀 Starting server on port 5000..."
    npm run server &
    SERVER_PID=$!
    sleep 2
    echo "🚀 Starting client on port 5173..."
    npm run dev
    kill $SERVER_PID 2>/dev/null
elif [ "$choice" = "2" ]; then
    npm run server
elif [ "$choice" = "3" ]; then
    npm run dev
else
    echo "Invalid choice"
fi
