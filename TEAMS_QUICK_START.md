# Teams Notifications - Quick Start

Get Teams notifications working in 10 minutes!

---

## 🚀 Quick Setup (3 Steps)

### 1️⃣ Create Power Automate Flow (5 min)

1. Go to https://make.powerautomate.com
2. Create → Automated cloud flow → "When a HTTP request is received"
3. Use sample payload from `POWER_AUTOMATE_SETUP_GUIDE.md` Step 2
4. Add condition for severity
5. Add Teams actions for both branches (copy Adaptive Card JSON from guide)
6. Save and copy the webhook URL

### 2️⃣ Deploy Backend (3 min)

```bash
# Run deployment script with your webhook URL
./deploy-teams-integration.sh 'YOUR_WEBHOOK_URL_HERE'
```

### 3️⃣ Test It (2 min)

```bash
# Update test script with your webhook URL
nano test-teams-notification.sh
# Replace WEBHOOK_URL line

# Run test
./test-teams-notification.sh
```

**Done!** Check your Teams channel for 3 test notifications.

---

## 📱 What You'll Get

### 🔴 High Severity (Prod Changes)
```
🔴 Production Secret Changed
A production secret has been modified

🔐 Secret: database-password
📱 Application: webapp
🌍 Environment: Prod
⚡ Action: Secret Value Updated
👤 User: john@company.com
🕐 Time: 2026-01-27T15:30:00Z

[🔗 View in Portal]
```

### ⚠️ Medium Severity (Rotation Alerts)
```
⚠️ Secret Rotation Required
Secret needs rotation. Overdue by 5 days

🔐 Secret: api-key
📱 Application: api-service
🌍 Environment: Prod
⚡ Action: ROTATION_REQUIRED
👤 User: System
🕐 Time: 2026-01-27T15:30:00Z

[🔗 View in Portal]
```

### 🔵 Low Severity (Info)
```
🔵 Console Change Detected
Secret modified in AWS Console

🔐 Secret: config-value
📱 Application: webapp
🌍 Environment: NP
⚡ Action: PutSecretValue
👤 User: arn:aws:iam::123:user/admin
🕐 Time: 2026-01-27T15:30:00Z

[🔗 View in Portal]
```

---

## 🎯 Notification Triggers

| Event | Severity | When |
|-------|----------|------|
| Prod secret updated | 🔴 High | Immediately |
| Prod rotation changed | 🔴 High | Immediately |
| Secret overdue 30+ days | 🔴 High | Daily check |
| Secret overdue 7-30 days | ⚠️ Medium | Daily check |
| Console change detected | ⚠️ Medium | Immediately |
| Secret overdue <7 days | 🔵 Low | Daily check |

---

## 📋 Files Created

- `POWER_AUTOMATE_SETUP_GUIDE.md` - Detailed setup instructions
- `deploy-teams-integration.sh` - Automated deployment script
- `test-teams-notification.sh` - Test script
- `packages/backend-express/src/utils/notifications.ts` - Updated backend code

---

## 🔧 Configuration

### Environment Variables (on EC2)

```bash
USE_TEAMS_NOTIFICATIONS=true
TEAMS_WEBHOOK_URL=https://prod-xx.eastus.logic.azure.com:443/workflows/...
PORTAL_URL=http://44.220.58.117
```

### Check Configuration

```bash
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cat /home/ubuntu/packages/backend-express/.env | grep TEAMS"
```

---

## 🧪 Testing

### Manual Test

```bash
# Edit webhook URL in test script
nano test-teams-notification.sh

# Run test
./test-teams-notification.sh
```

### Trigger Real Notification

1. Login to portal: http://44.220.58.117
2. Update any Prod secret
3. Check Teams channel for notification

---

## 🔍 Monitoring

### Check Backend Logs

```bash
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "pm2 logs secrets-api | grep 'Teams notification'"
```

### Check Power Automate

1. Go to https://make.powerautomate.com
2. Click your flow
3. View "Run history"

---

## 🆘 Troubleshooting

### No Notifications Appearing

```bash
# 1. Check if Teams is enabled
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cat /home/ubuntu/packages/backend-express/.env | grep USE_TEAMS"
# Should show: USE_TEAMS_NOTIFICATIONS=true

# 2. Check webhook URL is set
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cat /home/ubuntu/packages/backend-express/.env | grep TEAMS_WEBHOOK"
# Should show your webhook URL

# 3. Check backend logs for errors
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "pm2 logs secrets-api --lines 50 | grep -i teams"

# 4. Test webhook directly
./test-teams-notification.sh
```

### Power Automate Errors

1. Check run history for error details
2. Verify Teams channel permissions
3. Test Adaptive Card JSON at https://adaptivecards.io/designer/

### Backend Errors

```bash
# Check if axios is installed
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && npm list axios"

# Reinstall if needed
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && npm install axios && pm2 restart secrets-api"
```

---

## 💡 Tips

1. **Create dedicated channel** - "Secrets Alerts" for better organization
2. **Pin important notifications** - Right-click → Pin in Teams
3. **Set up mobile notifications** - Get alerts on your phone
4. **Customize colors** - Edit Adaptive Card styles
5. **Add more actions** - Email, Slack, etc. in Power Automate

---

## 📚 Additional Resources

- **Full Setup Guide**: `POWER_AUTOMATE_SETUP_GUIDE.md`
- **Adaptive Cards Designer**: https://adaptivecards.io/designer/
- **Power Automate Docs**: https://docs.microsoft.com/power-automate/
- **Teams Webhooks**: https://docs.microsoft.com/microsoftteams/platform/webhooks-and-connectors/

---

## Summary

✅ **5 minutes** to set up Power Automate flow  
✅ **3 minutes** to deploy backend  
✅ **2 minutes** to test  
✅ **Beautiful** Adaptive Card notifications  
✅ **Free** - no additional cost  

**Total time: 10 minutes** ⏱️

Ready to get started? Follow the 3 steps at the top! 🚀
