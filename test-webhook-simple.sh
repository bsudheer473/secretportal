#!/bin/bash

# Simple webhook test
# IMPORTANT: Replace the entire URL below with your COMPLETE webhook URL from Power Automate

WEBHOOK_URL="PASTE_YOUR_COMPLETE_URL_HERE"

if [[ "$WEBHOOK_URL" == "PASTE_YOUR_COMPLETE_URL_HERE" ]]; then
    echo "❌ Error: Please update the WEBHOOK_URL in this script!"
    echo ""
    echo "Steps:"
    echo "1. Go to Power Automate"
    echo "2. Click on 'When a HTTP request is received' trigger"
    echo "3. Copy the ENTIRE HTTP POST URL (it's very long)"
    echo "4. Paste it in this script replacing PASTE_YOUR_COMPLETE_URL_HERE"
    echo ""
    echo "The URL should look like:"
    echo "https://...powerplatform.com:443/.../invoke?api-version=2024-10-01&sp=...&sv=...&sig=..."
    exit 1
fi

echo "🧪 Testing Teams notification..."
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "test",
    "title": "🧪 Test from Secrets Portal",
    "message": "If you see this in Teams, it works!",
    "secretName": "test-secret",
    "application": "webapp",
    "environment": "NP",
    "action": "TEST",
    "user": "test@example.com",
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "severity": "low",
    "portalUrl": "http://44.220.58.117"
  }'

echo ""
echo ""
echo "✅ Test sent! Check your Teams channel."
echo ""
echo "If you don't see a message:"
echo "1. Check Power Automate run history for errors"
echo "2. Make sure you copied the COMPLETE webhook URL"
echo "3. Verify the Teams channel is correct in your flow"
