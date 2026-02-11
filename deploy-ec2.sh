#!/bin/bash

EC2_IP="44.220.58.117"
KEY_FILE="$HOME/.ssh/aws-chatbot-key"

echo "🚀 Deploying Secrets Portal to EC2: $EC2_IP"
echo ""

# Wait for SSH to be ready
echo "Waiting for SSH to be ready..."
sleep 30

# Copy deployment package
echo "📦 Copying files to EC2..."
scp -i "$KEY_FILE" -o StrictHostKeyChecking=no secrets-portal-deploy.tar.gz ubuntu@$EC2_IP:/home/ubuntu/

# Deploy on EC2
echo "🔧 Setting up application on EC2..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e

echo "📥 Installing system dependencies..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y curl nginx

echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "🔧 Installing PM2..."
sudo npm install -g pm2

echo "📂 Extracting application..."
cd /home/ubuntu
tar -xzf secrets-portal-deploy.tar.gz

echo "⚙️  Configuring backend..."
cd /home/ubuntu/packages/backend-express

# Install production dependencies only
npm install --production

# Create .env file
cat > .env << EOF
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://44.220.58.117

AWS_REGION=us-east-1
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log

USER_POOL_ID=us-east-1_O9Yt0QiW0
CLIENT_ID=rm7cgr2uv294m25bscap5lfoj
EOF

echo "🚀 Starting backend with PM2..."
pm2 start dist/server.js --name secrets-api
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/secrets-portal > /dev/null << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    root /home/ubuntu/packages/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
NGINXCONF

sudo ln -sf /etc/nginx/sites-available/secrets-portal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "✅ Deployment complete!"
echo "🌐 Application URL: http://44.220.58.117"
echo ""
echo "📊 Status:"
pm2 status
echo ""
sudo systemctl status nginx --no-pager | head -10
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo "🌐 Access your application at: http://44.220.58.117"
echo ""
echo "Login credentials:"
echo "  Email: admin@example.com"
echo "  Password: AdminPassword123!"
