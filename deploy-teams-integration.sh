#!/bin/bash

echo "=========================================="
echo "Deploying Teams Integration"
echo "=========================================="
echo ""

# Check if webhook URL is provided
if [ -z "$1" ]; then
    echo "❌ Error: Webhook URL required!"
    echo ""
    echo "Usage: ./deploy-teams-integration.sh YOUR_WEBHOOK_URL"
    echo ""
    echo "Steps:"
    echo "1. Create Power Automate flow (see POWER_AUTOMATE_SETUP_GUIDE.md)"
    echo "2. Copy the HTTP POST URL"
    echo "3. Run: ./deploy-teams-integration.sh 'YOUR_WEBHOOK_URL'"
    exit 1
fi

WEBHOOK_URL="$1"

echo "📦 Step 1: Building backend..."
cd packages/backend-express
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful!"
echo ""

echo "📤 Step 2: Deploying to EC2..."
scp -i ~/.ssh/aws-chatbot-key dist/utils/notifications.js \
  ubuntu@44.220.58.117:/home/ubuntu/packages/backend-express/dist/utils/
if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi
echo "✅ Files deployed!"
echo ""

echo "📦 Step 3: Installing axios on EC2..."
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && npm install axios"
if [ $? -ne 0 ]; then
    echo "❌ axios installation failed!"
    exit 1
fi
echo "✅ axios installed!"
echo ""

echo "⚙️  Step 4: Updating environment variables..."
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 << EOF
cd /home/ubuntu/packages/backend-express

# Backup existing .env
cp .env .env.backup

# Add Teams configuration
if ! grep -q "USE_TEAMS_NOTIFICATIONS" .env; then
    echo "" >> .env
    echo "# Microsoft Teams Notifications" >> .env
    echo "USE_TEAMS_NOTIFICATIONS=true" >> .env
    echo "TEAMS_WEBHOOK_URL=$WEBHOOK_URL" >> .env
    echo "PORTAL_URL=http://44.220.58.117" >> .env
    echo "✅ Environment variables added"
else
    echo "⚠️  Teams configuration already exists in .env"
    echo "Please update manually if needed"
fi
EOF
echo ""

echo "🔄 Step 5: Restarting backend..."
ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 \
  "cd /home/ubuntu/packages/backend-express && pm2 restart secrets-api"
if [ $? -ne 0 ]; then
    echo "❌ Restart failed!"
    exit 1
fi
echo "✅ Backend restarted!"
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo "1. Test the integration:"
echo "   ./test-teams-notification.sh"
echo ""
echo "2. Update a Prod secret in the portal to trigger a real notification"
echo ""
echo "3. Check logs:"
echo "   ssh -i ~/.ssh/aws-chatbot-key ubuntu@44.220.58.117 'pm2 logs secrets-api | grep Teams'"
echo ""
echo "4. Monitor Power Automate run history:"
echo "   https://make.powerautomate.com"
echo ""
