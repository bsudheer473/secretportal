#!/bin/bash

# Test with the URL you provided
WEBHOOK_URL="https://default16532572d5674d678727f12f7bb6ae.d3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/f06c16f49362404d9575c957f3232399/triggers/manual/paths/invoke?api-version=1.0"

echo "🧪 Testing Teams notification with fixed URL..."
echo ""
echo "URL: $WEBHOOK_URL"
echo ""

curl -v -X POST "$WEBHOOK_URL" \
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
  }' 2>&1

echo ""
echo ""
echo "Check the response above for errors."
echo "Also check Power Automate run history: https://make.powerautomate.com"
