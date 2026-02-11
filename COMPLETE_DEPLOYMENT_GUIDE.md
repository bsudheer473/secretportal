# Complete Deployment Guide - New AWS Account

This guide will help you deploy the entire Secrets Manager Portal in a new AWS account from scratch.

**Time Required**: 2-3 hours  
**Cost**: $44-60/month  
**Prerequisites**: AWS Account, AWS CLI, Node.js 18+

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Infrastructure Setup](#aws-infrastructure-setup)
3. [Build Application](#build-application)
4. [Deploy Backend](#deploy-backend)
5. [Deploy Frontend](#deploy-frontend)
6. [Configure Authentication](#configure-authentication)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

### Required Tools

```bash
# Check if installed
node --version  # Should be 18+
npm --version
aws --version
```

### Install if needed

```bash
# Node.js (Mac)
brew install node@18

# AWS CLI (Mac)
brew install awscli

# Configure AWS CLI
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)
```

### Download Source Code

```bash
# Clone or download the repository
cd /path/to/secrets-portal

# Install dependencies
npm install
cd packages/backend-express && npm install
cd ../frontend && npm install
cd ../..
```

---

## 2. AWS Infrastructure Setup

### Step 1: Create DynamoDB Tables

#### Table 1: secrets-metadata

```bash
aws dynamodb create-table \
  --table-name secrets-metadata \
  --attribute-definitions \
    AttributeName=secretId,AttributeType=S \
    AttributeName=application,AttributeType=S \
    AttributeName=environment,AttributeType=S \
  --key-schema \
    AttributeName=secretId,KeyType=HASH \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"ApplicationEnvironmentIndex\",
        \"KeySchema\": [
          {\"AttributeName\":\"application\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"environment\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"},
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### Table 2: secrets-audit-log

```bash
aws dynamodb create-table \
  --table-name secrets-audit-log \
  --attribute-definitions \
    AttributeName=secretId,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=secretId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### Table 3: aws-console-changes

```bash
aws dynamodb create-table \
  --table-name aws-console-changes \
  --attribute-definitions \
    AttributeName=secretArn,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=secretArn,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Verify tables created**:
```bash
aws dynamodb list-tables --region us-east-1
```

---

### Step 2: Create Cognito User Pool

#### Create User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name secrets-portal-users \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --region us-east-1 \
  --output json > cognito-pool.json

# Save the UserPoolId
USER_POOL_ID=$(cat cognito-pool.json | grep -o '"Id": "[^"]*' | cut -d'"' -f4)
echo "User Pool ID: $USER_POOL_ID"
```

#### Create User Pool Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name secrets-portal-client \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --access-token-validity 8 \
  --id-token-validity 8 \
  --refresh-token-validity 30 \
  --token-validity-units '{
    "AccessToken": "hours",
    "IdToken": "hours",
    "RefreshToken": "days"
  }' \
  --region us-east-1 \
  --output json > cognito-client.json

# Save the ClientId
CLIENT_ID=$(cat cognito-client.json | grep -o '"ClientId": "[^"]*' | cut -d'"' -f4)
echo "Client ID: $CLIENT_ID"
```

#### Create User Groups

```bash
# Admin group
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name secrets-admin \
  --description "Full access to all secrets" \
  --region us-east-1

# Application-specific groups (repeat for each app)
for app in webapp api-service windows; do
  aws cognito-idp create-group \
    --user-pool-id $USER_POOL_ID \
    --group-name ${app}-developer \
    --description "Read/write access to ${app} NP/PP" \
    --region us-east-1
    
  aws cognito-idp create-group \
    --user-pool-id $USER_POOL_ID \
    --group-name ${app}-prod-viewer \
    --description "Read-only access to ${app} Prod" \
    --region us-east-1
done
```

#### Create Admin User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password "TempAdmin123!" \
  --region us-east-1

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --group-name secrets-admin \
  --region us-east-1
```

---

### Step 3: Create EC2 Instance

#### Create Security Group

```bash
aws ec2 create-security-group \
  --group-name secrets-portal-sg \
  --description "Security group for Secrets Portal" \
  --region us-east-1 \
  --output json > security-group.json

SG_ID=$(cat security-group.json | grep -o '"GroupId": "[^"]*' | cut -d'"' -f4)
echo "Security Group ID: $SG_ID"

# Allow HTTP
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region us-east-1

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region us-east-1

# Allow SSH (replace with your IP)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32 \
  --region us-east-1
```

#### Create Key Pair

```bash
aws ec2 create-key-pair \
  --key-name secrets-portal-key \
  --query 'KeyMaterial' \
  --output text \
  --region us-east-1 > secrets-portal-key.pem

chmod 400 secrets-portal-key.pem
```

#### Launch EC2 Instance

```bash
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --key-name secrets-portal-key \
  --security-group-ids $SG_ID \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=secrets-portal}]' \
  --region us-east-1 \
  --output json > ec2-instance.json

INSTANCE_ID=$(cat ec2-instance.json | grep -o '"InstanceId": "[^"]*' | cut -d'"' -f4)
echo "Instance ID: $INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region us-east-1

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text \
  --region us-east-1)

echo "Public IP: $PUBLIC_IP"
```

---

## 3. Build Application

### Build Backend

```bash
cd packages/backend-express
npm run build
cd ../..
```

### Build Frontend

```bash
cd packages/frontend

# Update API URL in config
cat > src/config/environment.ts << EOF
const config = {
  apiBaseUrl: 'http://$PUBLIC_IP/api',
  environment: 'production'
};

export default config;
EOF

npm run build
cd ../..
```

---

## 4. Deploy Backend

### Step 1: Setup EC2

```bash
# SSH into EC2
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Create application directory
mkdir -p ~/packages/backend-express
exit
```

### Step 2: Copy Backend Files

```bash
# From your local machine
scp -i secrets-portal-key.pem -r packages/backend-express/dist ubuntu@$PUBLIC_IP:~/packages/backend-express/
scp -i secrets-portal-key.pem packages/backend-express/package*.json ubuntu@$PUBLIC_IP:~/packages/backend-express/
```

### Step 3: Configure Backend

```bash
# SSH back in
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP

cd ~/packages/backend-express

# Install dependencies
npm ci --only=production

# Create .env file
cat > .env << EOF
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://$PUBLIC_IP

AWS_REGION=us-east-1
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log
AWS_CONSOLE_CHANGES_TABLE=aws-console-changes

USER_POOL_ID=$USER_POOL_ID
CLIENT_ID=$CLIENT_ID

USE_TEAMS_NOTIFICATIONS=false
PORTAL_URL=http://$PUBLIC_IP
EOF

# Start with PM2
export $(cat .env | xargs)
pm2 start dist/server.js --name secrets-api
pm2 save
pm2 startup

exit
```

---

## 5. Deploy Frontend

### Copy Frontend Files

```bash
# From your local machine
scp -i secrets-portal-key.pem -r packages/frontend/dist/* ubuntu@$PUBLIC_IP:~/frontend/
```

### Configure Nginx

```bash
# SSH into EC2
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP

# Create Nginx config
sudo tee /etc/nginx/sites-available/secrets-portal << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/secrets-portal;
    index index.html;

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Move frontend files
sudo mkdir -p /var/www/secrets-portal
sudo cp -r ~/frontend/* /var/www/secrets-portal/

# Enable site
sudo ln -s /etc/nginx/sites-available/secrets-portal /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx

exit
```

---

## 6. Configure Authentication

### Create IAM Role for EC2

```bash
# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name SecretsPortalEC2Role \
  --assume-role-policy-document file://trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name SecretsPortalEC2Role \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

aws iam attach-role-policy \
  --role-name SecretsPortalEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name SecretsPortalEC2Profile

aws iam add-role-to-instance-profile \
  --instance-profile-name SecretsPortalEC2Profile \
  --role-name SecretsPortalEC2Role

# Attach to EC2 instance
aws ec2 associate-iam-instance-profile \
  --instance-id $INSTANCE_ID \
  --iam-instance-profile Name=SecretsPortalEC2Profile
```

---

## 7. Testing

### Test Backend

```bash
curl http://$PUBLIC_IP/api/secrets/applications
# Should return: {"error":{"code":"AUTH_FAILED"...}} (expected without auth)
```

### Test Frontend

```bash
# Open in browser
open http://$PUBLIC_IP
```

### Login

1. Go to `http://$PUBLIC_IP`
2. Login with: `admin@example.com` / `TempAdmin123!`
3. Change password when prompted
4. You should see the secrets list

---

## 8. Configuration Summary

Save these values for reference:

```bash
# Create config file
cat > deployment-config.txt << EOF
AWS Account: $(aws sts get-caller-identity --query Account --output text)
Region: us-east-1
User Pool ID: $USER_POOL_ID
Client ID: $CLIENT_ID
EC2 Instance ID: $INSTANCE_ID
Public IP: $PUBLIC_IP
Security Group: $SG_ID

Access URL: http://$PUBLIC_IP
Admin User: admin@example.com
Admin Password: TempAdmin123! (change on first login)

DynamoDB Tables:
- secrets-metadata
- secrets-audit-log
- aws-console-changes
EOF

cat deployment-config.txt
```

---

## 9. Post-Deployment Tasks

### Create Additional Users

```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password "TempPass123!" \
  --region us-east-1

# Add to group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --group-name webapp-developer \
  --region us-east-1
```

### Setup Teams Notifications (Optional)

See `POWER_AUTOMATE_SETUP_GUIDE.md` for details.

---

## 10. Troubleshooting

### Backend not starting

```bash
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP
pm2 logs secrets-api
pm2 restart secrets-api
```

### Frontend not loading

```bash
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

### Can't login

- Check Cognito user exists
- Verify USER_POOL_ID and CLIENT_ID in .env
- Check PM2 logs for auth errors

---

## Summary

✅ **Infrastructure**: DynamoDB, Cognito, EC2  
✅ **Backend**: Express API with PM2  
✅ **Frontend**: React app with Nginx  
✅ **Authentication**: Cognito with group-based permissions  
✅ **Cost**: ~$44-60/month  

**Access your portal**: `http://$PUBLIC_IP`

**Next Steps**:
1. Setup custom domain (Route53)
2. Add SSL certificate (ACM + ALB)
3. Configure Teams notifications
4. Create additional users
5. Setup backup/monitoring

---

## Quick Reference Commands

```bash
# Check backend status
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP "pm2 status"

# View backend logs
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP "pm2 logs secrets-api"

# Restart backend
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP "pm2 restart secrets-api"

# Check Nginx status
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP "sudo systemctl status nginx"

# View Nginx logs
ssh -i secrets-portal-key.pem ubuntu@$PUBLIC_IP "sudo tail -f /var/log/nginx/error.log"
```

---

**Deployment Complete!** 🎉

Your Secrets Manager Portal is now running in your new AWS account!
