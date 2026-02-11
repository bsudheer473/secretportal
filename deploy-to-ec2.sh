#!/bin/bash

EC2_IP="44.221.59.119"
KEY_FILE="~/.ssh/aws-chatbot-key.pem"

echo "🚀 Deploying Secrets Portal to EC2..."

# Wait for EC2 to be ready
echo "Waiting for EC2 to be ready..."
sleep 30

# Create deployment package
echo "Creating deployment package..."
tar -czf secrets-portal.tar.gz \
  packages/backend-express/dist \
  packages/backend-express/package.json \
  packages/backend-express/node_modules \
  packages/frontend/dist

# Copy to EC2
echo "Copying files to EC2..."
scp -i $KEY_FILE -o StrictHostKeyChecking=no secrets-portal.tar.gz ubuntu@$EC2_IP:/home/ubuntu/

# Deploy on EC2
echo "Deploying on EC2..."
ssh -i $KEY_FILE -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
# Update system
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx and PM2
sudo apt install -y nginx
sudo npm install -g pm2

# Extract application
cd /home/ubuntu
tar -xzf secrets-portal.tar.gz

# Create .env file
cat > /home/ubuntu/packages/backend-express/.env << EOF
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://44.221.59.119

AWS_REGION=us-east-1
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log

USER_POOL_ID=us-east-1_O9Yt0QiW0
CLIENT_ID=rm7cgr2uv294m25bscap5lfoj
EOF

# Start backend with PM2
cd /home/ubuntu/packages/backend-express
pm2 start dist/server.js --name secrets-api
pm2 save
pm2 startup | tail -1 | sudo bash

# Configure Nginx
sudo tee /etc/nginx/sites-available/secrets-portal << 'EOF'
server {
    listen 80;
    server_name _;

    root /home/ubuntu/packages/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/secrets-portal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Access at: http://44.221.59.119"
ENDSSH

echo "✅ Done! Access your application at: http://44.221.59.119"
