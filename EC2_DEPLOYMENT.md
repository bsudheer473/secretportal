# EC2 Deployment Guide for Secrets Portal

This guide will help you deploy the Secrets Portal on a single EC2 instance.

## Architecture

```
EC2 Instance
├── Nginx (Port 80/443) → Reverse Proxy
├── Express API (Port 3000) → Backend
└── React App (Static files) → Frontend
```

## Prerequisites

- AWS EC2 instance (t3.medium or larger recommended)
- Ubuntu 22.04 LTS
- Security Group allowing ports 80, 443, and 22
- IAM role attached to EC2 with permissions for:
  - DynamoDB (secrets-metadata, secrets-audit-log)
  - Secrets Manager
  - SNS (for notifications)

## Step 1: Launch EC2 Instance

```bash
# Create an EC2 instance with:
# - AMI: Ubuntu 22.04 LTS
# - Instance Type: t3.medium
# - Storage: 20GB gp3
# - Security Group: Allow 80, 443, 22
# - IAM Role: SecretsPortalEC2Role (create this with necessary permissions)
```

## Step 2: Connect and Install Dependencies

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

## Step 3: Clone and Build Application

```bash
# Clone your repository
cd /home/ubuntu
git clone <your-repo-url> secrets-portal
cd secrets-portal

# Install dependencies
npm install

# Build all packages
npm run build

# Build Express backend
cd packages/backend-express
npm install
npm run build
```

## Step 4: Configure Environment

```bash
# Create .env file for backend
cd /home/ubuntu/secrets-portal/packages/backend-express
cat > .env << EOF
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://your-ec2-ip

AWS_REGION=us-east-1
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log

USER_POOL_ID=us-east-1_O9Yt0QiW0
CLIENT_ID=rm7cgr2uv294m25bscap5lfoj
EOF

# Build frontend with correct API URL
cd /home/ubuntu/secrets-portal/packages/frontend
cat > .env.production << EOF
VITE_API_ENDPOINT=http://your-ec2-ip/api/
VITE_USER_POOL_ID=us-east-1_O9Yt0QiW0
VITE_USER_POOL_CLIENT_ID=rm7cgr2uv294m25bscap5lfoj
VITE_AWS_REGION=us-east-1
EOF

npm run build
```

## Step 5: Start Backend with PM2

```bash
cd /home/ubuntu/secrets-portal/packages/backend-express

# Start with PM2
pm2 start dist/server.js --name secrets-api

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Run the command that PM2 outputs
```

## Step 6: Configure Nginx

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/secrets-portal << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend
    root /home/ubuntu/secrets-portal/packages/frontend/dist;
    index index.html;

    # API proxy
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

    # Frontend routing (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/secrets-portal /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 7: Verify Deployment

```bash
# Check backend is running
pm2 status
pm2 logs secrets-api

# Check Nginx is running
sudo systemctl status nginx

# Test API health
curl http://localhost:3000/health

# Test through Nginx
curl http://localhost/api/health
```

## Step 8: Access the Application

Open your browser and navigate to:
```
http://your-ec2-ip
```

Login with your Cognito credentials:
- Email: admin@example.com
- Password: AdminPassword123!

## Maintenance Commands

```bash
# View backend logs
pm2 logs secrets-api

# Restart backend
pm2 restart secrets-api

# Restart Nginx
sudo systemctl restart nginx

# Update application
cd /home/ubuntu/secrets-portal
git pull
npm run build
cd packages/backend-express
npm run build
pm2 restart secrets-api
```

## Optional: Set up HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure Nginx for HTTPS
```

## Troubleshooting

### Backend not starting
```bash
pm2 logs secrets-api --lines 100
```

### Frontend not loading
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### API returning 500 errors
```bash
# Check IAM role permissions
aws sts get-caller-identity

# Check DynamoDB access
aws dynamodb describe-table --table-name secrets-metadata
```

### CORS errors
Make sure FRONTEND_URL in .env matches your actual frontend URL

## Security Recommendations

1. **Use HTTPS**: Set up SSL certificate with Let's Encrypt
2. **Restrict Security Group**: Only allow necessary IPs
3. **Enable CloudWatch**: Send logs to CloudWatch for monitoring
4. **Regular Updates**: Keep system and packages updated
5. **Backup**: Regular snapshots of EC2 instance

## Cost Estimate

- EC2 t3.medium: ~$30/month
- EBS 20GB: ~$2/month
- Data transfer: ~$5/month
- **Total: ~$37/month**

Much simpler than serverless and easier to debug!
