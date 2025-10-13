#!/bin/bash

echo "🔧 Setting up WhatsApp webhooks for local testing..."
echo ""

# Check if backend server is running
echo "📡 Checking if backend server is running..."
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ Backend server is running on port 5001"
else
    echo "❌ Backend server is not running"
    echo "Please start it with: cd backend && npm start"
    exit 1
fi

echo ""
echo "🌐 Starting ngrok tunnel..."
echo "This will expose your local server to the internet so UniPile can send webhooks"
echo ""

# Start ngrok in background
ngrok http 5001 --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the public URL
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PUBLIC_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    kill $NGROK_PID
    exit 1
fi

echo "✅ Ngrok tunnel started successfully!"
echo "🌍 Public URL: $PUBLIC_URL"
echo ""
echo "📋 Next steps:"
echo "1. Go to your UniPile dashboard"
echo "2. Navigate to 'Webhooks' section"
echo "3. Add a new webhook with:"
echo "   - URL: $PUBLIC_URL/api/webhooks/unipile"
echo "   - Events: message.new, account.updated, connection.status"
echo "   - Secret: Generate a new secret"
echo ""
echo "4. Update your .env file with the webhook secret:"
echo "   UNIPILE_WEBHOOK_SECRET=your-generated-secret"
echo ""
echo "5. Test by sending a WhatsApp message to your connected number"
echo ""
echo "🔍 To monitor webhook activity:"
echo "   - Check ngrok logs: tail -f ngrok.log"
echo "   - Check backend logs for incoming webhooks"
echo ""
echo "⏹️  To stop ngrok: kill $NGROK_PID"
echo ""

# Keep the script running
echo "Press Ctrl+C to stop ngrok and exit"
wait $NGROK_PID
