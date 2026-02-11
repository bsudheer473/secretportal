#!/bin/bash
set -e

# Update system
apt update
DEBIAN_FRONTEND=noninteractive apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Nginx, Git, and other tools
apt install -y nginx git zip unzip

# Install PM2
npm install -g pm2

# Create app directory
mkdir -p /opt/secrets-portal
cd /opt/secrets-portal

# Clone or download application (we'll upload it separately)
# For now, create placeholder structure
mkdir -p backend frontend

# Create backend .env
cat > /opt/secrets-portal/backend/.env << 'EOF'
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://44.221.59.119

AWS_REGION=us-east-1
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log

USER_POOL_ID=us-east-1_O9Yt0QiW0
CLIENT_ID=rm7cgr2uv294m25bscap5lfoj
EOF

# Configure Nginx
cat > /etc/nginx/sites-available/secrets-portal << 'EOF'
server {
    listen 80;
    server_name _;

    root /opt/secrets-portal/frontend;
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
EOF

ln -sf /etc/nginx/sites-available/secrets-portal /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl enable nginx
systemctl restart nginx

# Create deployment marker
echo "EC2 setup complete at $(date)" > /opt/secrets-portal/setup-complete.txt
