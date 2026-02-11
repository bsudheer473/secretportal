# Microsoft Teams Notifications Setup

This guide shows how to send Secrets Portal notifications to Microsoft Teams using Power Automate and webhooks.

---

## 🎯 Overview

Instead of (or in addition to) SNS email notifications, you can send alerts to Microsoft Teams channels for:
- 🔴 Prod secret changes
- ⚠️ Secrets requiring rotation
- 🔍 Direct AWS console changes
- 📊 Daily/weekly reports

---

## 🔧 Setup Options

### Option 1: Power Automate (Recommended)
**Pros**: No coding, easy to customize, rich formatting  
**Cons**: Requires Power Automate license

### Option 2: Teams Incoming Webhook
**Pros**: Free, simple, direct HTTP POST  
**Cons**: Limited formatting, deprecated (but still works)

### Option 3: Teams Connector (Workflows)
**Pros**: Native Teams feature, no license needed  
**Cons**: Less flexible than Power Automate

---

## 📋 Option 1: Power Automate Setup

### Step 1: Create Power Automate Flow

1. Go to [Power Automate](https://make.powerautomate.com)
2. Click **Create** → **Automated cloud flow**
3. Name: "Secrets Portal Notifications"
4. Trigger: **When a HTTP request is received**
5. Click **Create**

### Step 2: Configure HTTP Trigger

The trigger will generate a webhook URL. Configure the JSON schema:

```json
{
    "type": "object",
    "properties": {
        "notificationType": {
            "type": "string"
        },
        "title": {
            "type": "string"
        },
        "message": {
            "type": "string"
        },
        "secretName": {
            "type": "string"
        },
        "application": {
            "type": "string"
        },
        "environment": {
            "type": "string"
        },
        "action": {
            "type": "string"
        },
        "user": {
            "type": "string"
        },
        "timestamp": {
            "type": "string"
        },
        "severity": {
            "type": "string"
        }
    }
}
```

### Step 3: Add Teams Action

1. Click **+ New step**
2. Search for "Post message in a chat or channel"
3. Select **Microsoft Teams** connector
4. Configure:
   - **Post as**: Flow bot
   - **Post in**: Channel
   - **Team**: Select your team
   - **Channel**: Select your channel (e.g., "Secrets Alerts")

### Step 4: Design Message Template

Use Adaptive Cards for rich formatting:

```json
{
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "Container",
            "style": "@{if(equals(triggerBody()?['severity'], 'high'), 'attention', if(equals(triggerBody()?['severity'], 'medium'), 'warning', 'good'))}",
            "items": [
                {
                    "type": "TextBlock",
                    "size": "Large",
                    "weight": "Bolder",
                    "text": "@{triggerBody()?['title']}"
                },
                {
                    "type": "TextBlock",
                    "text": "@{triggerBody()?['message']}",
                    "wrap": true
                }
            ]
        },
        {
            "type": "FactSet",
            "facts": [
                {
                    "title": "Secret:",
                    "value": "@{triggerBody()?['secretName']}"
                },
                {
                    "title": "Application:",
                    "value": "@{triggerBody()?['application']}"
                },
                {
                    "title": "Environment:",
                    "value": "@{triggerBody()?['environment']}"
                },
                {
                    "title": "Action:",
                    "value": "@{triggerBody()?['action']}"
                },
                {
                    "title": "User:",
                    "value": "@{triggerBody()?['user']}"
                },
                {
                    "title": "Time:",
                    "value": "@{triggerBody()?['timestamp']}"
                }
            ]
        }
    ],
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.4"
}
```

### Step 5: Save and Get Webhook URL

1. Click **Save**
2. Go back to the HTTP trigger
3. Copy the **HTTP POST URL** - this is your webhook URL
4. It will look like: `https://prod-xx.eastus.logic.azure.com:443/workflows/xxxxx/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xxxxx`

---

## 📋 Option 2: Teams Incoming Webhook (Simple)

### Step 1: Create Incoming Webhook in Teams

1. Open Microsoft Teams
2. Go to your channel (e.g., "Secrets Alerts")
3. Click **⋯** (More options) → **Connectors** → **Incoming Webhook**
4. Click **Configure**
5. Name: "Secrets Portal"
6. Upload an icon (optional)
7. Click **Create**
8. **Copy the webhook URL** - save this!
9. Click **Done**

### Step 2: Test the Webhook

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "summary": "Test Notification",
    "themeColor": "0078D7",
    "title": "🔔 Secrets Portal Test",
    "text": "This is a test notification from Secrets Portal",
    "sections": [{
        "facts": [
            {"name": "Status:", "value": "Working!"},
            {"name": "Time:", "value": "'"$(date)"'"}
        ]
    }]
}'
```

---

## 🔨 Backend Integration

### Update Notification Utility

Update `packages/backend-express/src/utils/notifications.ts`:

```typescript
import axios from 'axios';

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || '';
const USE_TEAMS = process.env.USE_TEAMS_NOTIFICATIONS === 'true';

interface TeamsNotification {
  notificationType: string;
  title: string;
  message: string;
  secretName: string;
  application: string;
  environment: string;
  action: string;
  user: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Send notification to Microsoft Teams
 */
export async function sendTeamsNotification(notification: TeamsNotification): Promise<void> {
  if (!USE_TEAMS || !TEAMS_WEBHOOK_URL) {
    console.log('Teams notifications disabled or webhook URL not configured');
    return;
  }

  try {
    // For Power Automate webhook
    if (TEAMS_WEBHOOK_URL.includes('logic.azure.com')) {
      await axios.post(TEAMS_WEBHOOK_URL, notification);
    } 
    // For Teams Incoming Webhook (MessageCard format)
    else {
      const messageCard = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: notification.title,
        themeColor: notification.severity === 'high' ? 'FF0000' : 
                   notification.severity === 'medium' ? 'FFA500' : '0078D7',
        title: `${getSeverityEmoji(notification.severity)} ${notification.title}`,
        text: notification.message,
        sections: [{
          facts: [
            { name: 'Secret:', value: notification.secretName },
            { name: 'Application:', value: notification.application },
            { name: 'Environment:', value: notification.environment },
            { name: 'Action:', value: notification.action },
            { name: 'User:', value: notification.user },
            { name: 'Time:', value: notification.timestamp },
          ]
        }],
        potentialAction: [{
          '@type': 'OpenUri',
          name: 'View in Portal',
          targets: [{
            os: 'default',
            uri: `http://44.220.58.117/secrets`
          }]
        }]
      };

      await axios.post(TEAMS_WEBHOOK_URL, messageCard);
    }

    console.log('Teams notification sent successfully');
  } catch (error) {
    console.error('Failed to send Teams notification:', error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'high': return '🔴';
    case 'medium': return '⚠️';
    case 'low': return '🔵';
    default: return '📢';
  }
}

/**
 * Send Prod secret change notification to Teams
 */
export async function sendProdSecretChangeNotification(
  secretName: string,
  application: string,
  action: string,
  details: string,
  user: string
): Promise<void> {
  await sendTeamsNotification({
    notificationType: 'prod_change',
    title: '🔴 Production Secret Changed',
    message: `A production secret has been modified. ${details}`,
    secretName,
    application,
    environment: 'Prod',
    action,
    user,
    timestamp: new Date().toISOString(),
    severity: 'high'
  });
}

/**
 * Send rotation alert notification to Teams
 */
export async function sendRotationAlertNotification(
  secretName: string,
  application: string,
  environment: string,
  daysSinceRotation: number,
  rotationPeriod: number
): Promise<void> {
  const daysOverdue = daysSinceRotation - rotationPeriod;
  const severity = daysOverdue > 30 ? 'high' : daysOverdue > 7 ? 'medium' : 'low';

  await sendTeamsNotification({
    notificationType: 'rotation_alert',
    title: '⚠️ Secret Rotation Required',
    message: `Secret "${secretName}" needs rotation. Last rotated ${daysSinceRotation} days ago (policy: ${rotationPeriod} days).`,
    secretName,
    application,
    environment,
    action: 'ROTATION_REQUIRED',
    user: 'System',
    timestamp: new Date().toISOString(),
    severity
  });
}

/**
 * Send console change notification to Teams
 */
export async function sendConsoleChangeNotification(
  secretName: string,
  application: string,
  environment: string,
  changeType: string,
  user: string
): Promise<void> {
  await sendTeamsNotification({
    notificationType: 'console_change',
    title: '🔍 Direct AWS Console Change Detected',
    message: `A secret was modified directly in AWS Console, bypassing the portal.`,
    secretName,
    application,
    environment,
    action: changeType,
    user,
    timestamp: new Date().toISOString(),
    severity: 'medium'
  });
}
```

### Update Environment Variables

Add to `.env` file on EC2:

```bash
# Microsoft Teams Notifications
USE_TEAMS_NOTIFICATIONS=true
TEAMS_WEBHOOK_URL=https://prod-xx.eastus.logic.azure.com:443/workflows/xxxxx...
```

### Update Existing Notification Calls

In `packages/backend-express/src/controllers/secrets-controller.ts`:

```typescript
// After updating a Prod secret
if (metadata.environment === 'Prod') {
  await sendProdSecretChangeNotification(
    metadata.secretName,
    metadata.application,
    'UPDATE',
    'Secret value updated',
    user.email || user.userId
  );
}
```

---

## 📱 Notification Examples

### 1. Prod Secret Change
```
🔴 Production Secret Changed

A production secret has been modified. Secret value updated

Secret: database-password
Application: webapp
Environment: Prod
Action: UPDATE
User: john@company.com
Time: 2026-01-27T15:30:00Z

[View in Portal]
```

### 2. Rotation Alert
```
⚠️ Secret Rotation Required

Secret "api-key" needs rotation. Last rotated 95 days ago (policy: 90 days).

Secret: api-key
Application: api-service
Environment: Prod
Action: ROTATION_REQUIRED
User: System
Time: 2026-01-27T15:30:00Z

[View in Portal]
```

### 3. Console Change Detected
```
🔍 Direct AWS Console Change Detected

A secret was modified directly in AWS Console, bypassing the portal.

Secret: admin-password
Application: webapp
Environment: Prod
Action: PutSecretValue
User: arn:aws:iam::123456789:user/admin
Time: 2026-01-27T15:30:00Z

[View in Portal]
```

---

## 🎨 Customization Options

### Color Coding by Severity

```typescript
const colors = {
  high: 'FF0000',    // Red
  medium: 'FFA500',  // Orange
  low: '0078D7',     // Blue
  info: '00FF00'     // Green
};
```

### Add Action Buttons

```json
"potentialAction": [
  {
    "@type": "OpenUri",
    "name": "View Secret",
    "targets": [{
      "os": "default",
      "uri": "http://44.220.58.117/secrets/{{secretId}}"
    }]
  },
  {
    "@type": "OpenUri",
    "name": "Rotate Now",
    "targets": [{
      "os": "default",
      "uri": "http://44.220.58.117/secrets/{{secretId}}/rotate"
    }]
  }
]
```

### Mention Users

```json
{
  "type": "TextBlock",
  "text": "<at>John Doe</at> please review this change",
  "wrap": true
}
```

---

## 🧪 Testing

### Test Script

Create `test-teams-notification.sh`:

```bash
#!/bin/bash

WEBHOOK_URL="YOUR_WEBHOOK_URL_HERE"

# Test notification
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "test",
    "title": "🧪 Test Notification",
    "message": "This is a test from Secrets Portal",
    "secretName": "test-secret",
    "application": "webapp",
    "environment": "NP",
    "action": "TEST",
    "user": "test@example.com",
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "severity": "low"
  }'

echo ""
echo "Test notification sent! Check your Teams channel."
```

Run:
```bash
chmod +x test-teams-notification.sh
./test-teams-notification.sh
```

---

## 🔒 Security Best Practices

1. **Store webhook URL securely**
   - Use environment variables
   - Don't commit to git
   - Rotate periodically

2. **Validate webhook requests** (for Power Automate)
   - Add authentication header
   - Verify request source

3. **Rate limiting**
   - Don't spam Teams with too many notifications
   - Batch similar alerts

4. **Sensitive data**
   - Don't include secret values in notifications
   - Only include metadata

---

## 📊 Notification Strategy

### What to Send to Teams

✅ **Send**:
- Prod secret changes (high priority)
- Secrets overdue for rotation (daily digest)
- Direct AWS console changes (security alert)
- System errors or failures

❌ **Don't Send**:
- Every NP/PP secret change (too noisy)
- Successful routine operations
- Debug/info level logs

### Notification Frequency

- **Immediate**: Prod changes, security alerts
- **Daily Digest**: Rotation reminders, console changes
- **Weekly Report**: Summary of all activities

---

## 🚀 Deployment

### Step 1: Update Backend Code

```bash
# Copy updated notifications.ts to server
scp -i ~/.ssh/aws-chatbot-key \
  packages/backend-express/src/utils/notifications.ts \
  ubuntu@44.220.58.117:/home/ubuntu/packages/backend-express/src/utils/

# Rebuild
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && npm run build && pm2 restart secrets-api"
```

### Step 2: Update Environment Variables

```bash
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117

# Edit .env file
nano /home/ubuntu/packages/backend-express/.env

# Add:
USE_TEAMS_NOTIFICATIONS=true
TEAMS_WEBHOOK_URL=your_webhook_url_here

# Restart
pm2 restart secrets-api
```

### Step 3: Test

```bash
# Trigger a test notification by updating a Prod secret
# Check your Teams channel for the notification
```

---

## 📈 Monitoring

### Check Notification Logs

```bash
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117
pm2 logs secrets-api | grep "Teams notification"
```

### Power Automate Run History

1. Go to [Power Automate](https://make.powerautomate.com)
2. Click on your flow
3. View **Run history**
4. Check for failures or errors

---

## 🆘 Troubleshooting

### Notifications Not Appearing

1. **Check webhook URL** - Make sure it's correct
2. **Verify environment variable** - `USE_TEAMS_NOTIFICATIONS=true`
3. **Check Power Automate run history** - Look for errors
4. **Test webhook directly** - Use curl to test
5. **Check Teams channel permissions** - Make sure bot can post

### Formatting Issues

1. **Validate JSON** - Use jsonlint.com
2. **Check Adaptive Card schema** - Use adaptivecards.io/designer
3. **Test with simple message first** - Then add complexity

---

## Summary

✅ **Power Automate** - Best for rich formatting and customization  
✅ **Incoming Webhook** - Simple and free, good for basic alerts  
✅ **Easy Integration** - Just add webhook URL to environment variables  
✅ **No Additional Cost** - Teams notifications are free!  

**Recommended Setup**: Use Power Automate for production with Adaptive Cards for professional-looking notifications.
