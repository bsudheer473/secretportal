#!/bin/bash

# Test Microsoft Teams Notifications via Power Automate
# Replace WEBHOOK_URL with your actual Power Automate HTTP trigger URL

WEBHOOK_URL="https://default16532572d5674d678727f12f7bb6ae.d3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/f06c16f49362404d9575c957f3232399/triggers/manual/paths/invoke?api-version=1."

if [ "$WEBHOOK_URL" = "REPLACE_WITH_YOUR_WEBHOOK_URL" ]; then
    echo "❌ Error: Please update WEBHOOK_URL in this script first!"
    echo ""
    echo "Steps:"
    echo "1. Create Power Automate flow (see POWER_AUTOMATE_SETUP_GUIDE.md)"
    echo "2. Copy the HTTP POST URL from the trigger"
    echo "3. Replace WEBHOOK_URL in this script"
    echo "4. Run this script again"
    exit 1
fi

echo "=========================================="
echo "Testing Teams Notifications"
echo "=========================================="
echo ""

# Test 1: High Severity (Prod Change)
echo "📤 Test 1: Sending HIGH severity notification..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "prod_change",
    "title": "🔴 Production Secret Changed",
    "message": "This is a TEST notification for a production secret change. If you see this in Teams, high severity notifications are working!",
    "secretName": "test-database-password",
    "application": "webapp",
    "environment": "Prod",
    "action": "Secret Value Updated",
    "user": "test-user@example.com",
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "severity": "high",
    "portalUrl": "http://44.220.58.117"
  }'

echo ""
echo "✅ High severity test sent!"
echo ""
sleep 2

# Test 2: Medium Severity (Rotation Alert)
echo "📤 Test 2: Sending MEDIUM severity notification..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "rotation_alert",
    "title": "⚠️ Secret Rotation Required",
    "message": "This is a TEST notification for a rotation alert. If you see this in Teams, medium severity notifications are working!",
    "secretName": "test-api-key",
    "application": "api-service",
    "environment": "Prod",
    "action": "ROTATION_REQUIRED",
    "user": "System",
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "severity": "medium",
    "portalUrl": "http://44.220.58.117"
  }'

echo ""
echo "✅ Medium severity test sent!"
echo ""
sleep 2

# Test 3: Low Severity (Info)
echo "📤 Test 3: Sending LOW severity notification..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "test",
    "title": "🔵 Test Notification",
    "message": "This is a TEST notification with low severity. If you see this in Teams, low severity notifications are working!",
    "secretName": "test-config",
    "application": "webapp",
    "environment": "NP",
    "action": "TEST",
    "user": "test-user@example.com",
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "severity": "low",
    "portalUrl": "http://44.220.58.117"
  }'

echo ""
echo "✅ Low severity test sent!"
echo ""

echo "=========================================="
echo "All test notifications sent!"
echo "=========================================="
echo ""
echo "📱 Check your Microsoft Teams channel for 3 notifications:"
echo "   1. 🔴 Red card (High severity)"
echo "   2. ⚠️ Orange card (Medium severity)"
echo "   3. 🔵 Blue card (Low severity)"
echo ""
echo "If you don't see them:"
echo "   - Check Power Automate run history for errors"
echo "   - Verify webhook URL is correct"
echo "   - Make sure Flow bot has permission to post in channel"
echo ""
