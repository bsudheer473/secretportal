#!/bin/bash

EC2_IP="3.236.113.186"
INSTANCE_ID="i-05bebb7e25506b382"

echo "📦 Creating deployment package..."

# Create a complete deployment package
mkdir -p deploy-package
cp -r packages/backend-express/dist deploy-package/backend
cp -r packages/backend-express/node_modules deploy-package/backend/
cp packages/backend-express/package.json deploy-package/backend/
cp -r packages/frontend/dist deploy-package/frontend

# Create .env file
cat > deploy-package/backend/.env << EOF
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://${EC2_IP}

AWS_REGION=us-east-1
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log

USER_POOL_ID=us-east-1_O9Yt0QiW0
CLIENT_ID=rm7cgr2uv294m25bscap5lfoj
EOF

# Create deployment script for EC2
cat > deploy-package/deploy.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo "🚀 Deploying Secrets Portal..."

# Copy files
sudo mkdir -p /opt/secrets-portal
sudo cp -r /home/ubuntu/deploy-package/backend /opt/secrets-portal/
sudo cp -r /home/ubuntu/deploy-package/frontend /opt/secrets-portal/
sudo chown -R ubuntu:ubuntu /opt/secrets-portal

# Start backend with PM2
cd /opt/secrets-portal/backend
pm2 delete secrets-api 2>/dev/null || true
pm2 start dist/server.js --name secrets-api
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

# Restart Nginx
sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Access at: http://3.236.113.186"
pm2 status
DEPLOY_SCRIPT

chmod +x deploy-package/deploy.sh

# Create tarball
tar -czf app-package.tar.gz -C deploy-package .

echo "📤 Uploading to EC2..."

# Use AWS EC2 Instance Connect to upload
aws ec2-instance-connect send-ssh-public-key \
    --instance-id $INSTANCE_ID \
    --instance-os-user ubuntu \
    --ssh-public-key file://<(ssh-keygen -y -f ~/.ssh/id_rsa 2>/dev/null || ssh-keygen -t rsa -f ~/.ssh/id_rsa -N "" && cat ~/.ssh/id_rsa.pub) \
    --availability-zone us-east-1a 2>&1 || echo "Using alternative method..."

# Upload using scp with EC2 Instance Connect
scp -o StrictHostKeyChecking=no app-package.tar.gz ubuntu@${EC2_IP}:/home/ubuntu/ 2>&1 || echo "Upload method 1 failed, trying alternative..."

echo "✅ Package uploaded!"
echo ""
echo "Now SSH into the instance and run:"
echo "  ssh ubuntu@${EC2_IP}"
echo "  tar -xzf app-package.tar.gz"
echo "  ./deploy.sh"
