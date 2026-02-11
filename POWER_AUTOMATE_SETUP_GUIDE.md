# Power Automate Setup Guide - Step by Step

Follow these steps to set up Microsoft Teams notifications for your Secrets Portal.

---

## 📋 Prerequisites

- Microsoft 365 account with Power Automate access
- Microsoft Teams with a channel for notifications (e.g., "Secrets Alerts")
- Admin access to your Secrets Portal backend

---

## 🚀 Step-by-Step Setup

### Step 1: Create Power Automate Flow

1. Go to [Power Automate](https://make.powerautomate.com)
2. Click **+ Create** in the left sidebar
3. Select **Automated cloud flow**
4. Name your flow: **"Secrets Portal Notifications"**
5. In the search box, type: **"When a HTTP request is received"**
6. Select the trigger and click **Create**

---

### Step 2: Configure HTTP Request Trigger

1. Click on the **"When a HTTP request is received"** trigger
2. Click **"Use sample payload to generate schema"**
3. Paste this JSON sample:

```json
{
  "notificationType": "prod_change",
  "title": "Production Secret Changed",
  "message": "A production secret has been modified",
  "secretName": "database-password",
  "application": "webapp",
  "environment": "Prod",
  "action": "Secret Value Updated",
  "user": "john@company.com",
  "timestamp": "2026-01-27T15:30:00Z",
  "severity": "high",
  "portalUrl": "http://44.220.58.117"
}
```

4. Click **Done** - the schema will be auto-generated

---

### Step 3: Add Condition for Severity-Based Formatting

1. Click **+ New step**
2. Search for **"Condition"** and select it
3. Configure the condition:
   - **Choose a value**: Click and select `severity` from Dynamic content
   - **is equal to**: `high`

---

### Step 4: Add Teams Action (If High Severity)

In the **"If yes"** branch:

1. Click **Add an action**
2. Search for **"Post adaptive card in a chat or channel"**
3. Select **Microsoft Teams** connector
4. Configure:
   - **Post as**: Flow bot
   - **Post in**: Channel
   - **Team**: Select your team
   - **Channel**: Select your channel (e.g., "Secrets Alerts")

5. **Adaptive Card** - Paste this JSON:

```json
{
  "type": "AdaptiveCard",
  "body": [
    {
      "type": "Container",
      "style": "attention",
      "items": [
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "🔴",
                  "size": "ExtraLarge"
                }
              ]
            },
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "@{triggerBody()?['title']}",
                  "size": "Large",
                  "weight": "Bolder",
                  "wrap": true
                }
              ]
            }
          ]
        },
        {
          "type": "TextBlock",
          "text": "@{triggerBody()?['message']}",
          "wrap": true,
          "spacing": "Medium"
        }
      ]
    },
    {
      "type": "Container",
      "items": [
        {
          "type": "FactSet",
          "facts": [
            {
              "title": "🔐 Secret:",
              "value": "@{triggerBody()?['secretName']}"
            },
            {
              "title": "📱 Application:",
              "value": "@{triggerBody()?['application']}"
            },
            {
              "title": "🌍 Environment:",
              "value": "@{triggerBody()?['environment']}"
            },
            {
              "title": "⚡ Action:",
              "value": "@{triggerBody()?['action']}"
            },
            {
              "title": "👤 User:",
              "value": "@{triggerBody()?['user']}"
            },
            {
              "title": "🕐 Time:",
              "value": "@{triggerBody()?['timestamp']}"
            }
          ]
        }
      ],
      "spacing": "Medium"
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "🔗 View in Portal",
          "url": "@{triggerBody()?['portalUrl']}/secrets"
        }
      ]
    }
  ],
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4"
}
```

---

### Step 5: Add Teams Action (If Medium/Low Severity)

In the **"If no"** branch:

1. Click **Add an action**
2. Search for **"Post adaptive card in a chat or channel"**
3. Select **Microsoft Teams** connector
4. Configure same as above (Team, Channel, etc.)

5. **Adaptive Card** - Paste this JSON (for medium/low severity):

```json
{
  "type": "AdaptiveCard",
  "body": [
    {
      "type": "Container",
      "style": "warning",
      "items": [
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "@{if(equals(triggerBody()?['severity'], 'medium'), '⚠️', '🔵')}",
                  "size": "ExtraLarge"
                }
              ]
            },
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "@{triggerBody()?['title']}",
                  "size": "Large",
                  "weight": "Bolder",
                  "wrap": true
                }
              ]
            }
          ]
        },
        {
          "type": "TextBlock",
          "text": "@{triggerBody()?['message']}",
          "wrap": true,
          "spacing": "Medium"
        }
      ]
    },
    {
      "type": "Container",
      "items": [
        {
          "type": "FactSet",
          "facts": [
            {
              "title": "🔐 Secret:",
              "value": "@{triggerBody()?['secretName']}"
            },
            {
              "title": "📱 Application:",
              "value": "@{triggerBody()?['application']}"
            },
            {
              "title": "🌍 Environment:",
              "value": "@{triggerBody()?['environment']}"
            },
            {
              "title": "⚡ Action:",
              "value": "@{triggerBody()?['action']}"
            },
            {
              "title": "👤 User:",
              "value": "@{triggerBody()?['user']}"
            },
            {
              "title": "🕐 Time:",
              "value": "@{triggerBody()?['timestamp']}"
            }
          ]
        }
      ],
      "spacing": "Medium"
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "🔗 View in Portal",
          "url": "@{triggerBody()?['portalUrl']}/secrets"
        }
      ]
    }
  ],
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4"
}
```

---

### Step 6: Save and Get Webhook URL

1. Click **Save** at the top
2. Go back to the **"When a HTTP request is received"** trigger
3. The **HTTP POST URL** will now be visible
4. **Copy this URL** - you'll need it for the backend configuration

The URL will look like:
```
https://prod-xx.eastus.logic.azure.com:443/workflows/xxxxx/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xxxxx
```

---

## 🔧 Backend Configuration

### Step 7: Update Environment Variables on EC2

```bash
# SSH into your EC2 instance
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117

# Edit the .env file
nano /home/ubuntu/packages/backend-express/.env

# Add these lines (replace with your actual webhook URL):
USE_TEAMS_NOTIFICATIONS=true
TEAMS_WEBHOOK_URL=https://prod-xx.eastus.logic.azure.com:443/workflows/xxxxx...
PORTAL_URL=http://44.220.58.117

# Save and exit (Ctrl+X, then Y, then Enter)
```

### Step 8: Deploy Updated Backend

```bash
# Exit SSH first
exit

# From your local machine, deploy the updated code
cd packages/backend-express

# Copy updated files to EC2
scp -i ~/.ssh/aws-chatbot-key dist/utils/notifications.js \
  ubuntu@44.220.58.117:/home/ubuntu/packages/backend-express/dist/utils/

# Install axios on EC2
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && npm install axios"

# Restart the backend
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && pm2 restart secrets-api"
```

---

## 🧪 Testing

### Step 9: Test the Integration

Create a test script `test-teams-notification.sh`:

```bash
#!/bin/bash

# Replace with your actual Power Automate webhook URL
WEBHOOK_URL="YOUR_WEBHOOK_URL_HERE"

echo "Sending test notification to Teams..."

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "test",
    "title": "🧪 Test Notification from Secrets Portal",
    "message": "This is a test notification. If you see this in Teams, the integration is working!",
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
echo "✅ Test notification sent!"
echo "Check your Teams channel for the message."
```

Run the test:
```bash
chmod +x test-teams-notification.sh
./test-teams-notification.sh
```

---

## ✅ Verification Checklist

- [ ] Power Automate flow created and saved
- [ ] HTTP trigger configured with JSON schema
- [ ] Condition added for severity-based formatting
- [ ] Teams actions added for both branches
- [ ] Webhook URL copied
- [ ] Environment variables updated on EC2
- [ ] Backend code deployed
- [ ] axios installed on EC2
- [ ] Backend restarted
- [ ] Test notification sent successfully
- [ ] Notification appeared in Teams channel

---

## 🎨 Customization Options

### Change Colors

Edit the `"style"` property in the Adaptive Card:
- `"attention"` - Red (for high severity)
- `"warning"` - Orange (for medium severity)
- `"good"` - Green (for success)
- `"default"` - Blue (for info)

### Add More Actions

Add buttons to the `"ActionSet"`:

```json
{
  "type": "Action.OpenUrl",
  "title": "📧 Email Team",
  "url": "mailto:team@company.com?subject=Secret Alert"
}
```

### Mention Users

Add mentions in the message:

```json
{
  "type": "TextBlock",
  "text": "<at>John Doe</at> please review this change",
  "wrap": true
}
```

---

## 🔍 Monitoring

### Check Power Automate Run History

1. Go to [Power Automate](https://make.powerautomate.com)
2. Click on **"Secrets Portal Notifications"** flow
3. Click **"Run history"** tab
4. View successful runs and any errors

### Check Backend Logs

```bash
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117
pm2 logs secrets-api | grep "Teams notification"
```

---

## 🆘 Troubleshooting

### Notification Not Appearing

1. **Check webhook URL** - Make sure it's correct in .env
2. **Verify environment variable** - `echo $USE_TEAMS_NOTIFICATIONS` should be `true`
3. **Check Power Automate run history** - Look for failed runs
4. **Test webhook directly** - Use the test script
5. **Check Teams permissions** - Make sure Flow bot can post to channel

### Formatting Issues

1. **Validate Adaptive Card** - Use [Adaptive Cards Designer](https://adaptivecards.io/designer/)
2. **Check dynamic content** - Make sure all `@{triggerBody()?['field']}` references are correct
3. **Test with simple card first** - Then add complexity

### Backend Errors

```bash
# Check if axios is installed
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && npm list axios"

# Check environment variables
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cat /home/ubuntu/packages/backend-express/.env | grep TEAMS"

# Check backend logs
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "pm2 logs secrets-api --lines 50"
```

---

## 📊 What Gets Notified

### Automatic Notifications

1. **Prod Secret Changes** (High Severity 🔴)
   - When any Prod secret is updated
   - When Prod secret rotation period changes

2. **Rotation Alerts** (Medium/Low Severity ⚠️/🔵)
   - When secrets are overdue for rotation
   - Severity based on how overdue

3. **Console Changes** (Medium Severity ⚠️)
   - When secrets are modified directly in AWS Console
   - Bypassing the portal

---

## 🎯 Next Steps

1. **Set up rotation checker** - Schedule Lambda to check for overdue secrets
2. **Configure console change tracker** - Set up EventBridge to detect direct AWS changes
3. **Create daily digest** - Send summary of all changes once per day
4. **Add more notification types** - Failed logins, permission changes, etc.

---

## Summary

✅ Power Automate flow created with rich Adaptive Cards  
✅ Severity-based color coding (Red/Orange/Blue)  
✅ Backend integrated with Teams webhook  
✅ Test script provided for verification  
✅ Monitoring and troubleshooting guides included  

**You're all set!** Prod secret changes will now appear in your Teams channel with beautiful formatting! 🎉
