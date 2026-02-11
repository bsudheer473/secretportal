#!/bin/bash

# Secrets Portal - AWS Amplify Deployment Script
# This script helps you deploy the frontend to AWS Amplify

set -e

echo "🚀 Secrets Portal - AWS Amplify Deployment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is installed${NC}"

# Check if user is logged in
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Not logged into AWS${NC}"
    echo "Please run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ Logged into AWS Account: ${ACCOUNT_ID}${NC}"
echo ""

# Get user inputs
echo -e "${BLUE}📝 Configuration${NC}"
echo "================================"
echo ""

read -p "Enter your Git repository URL (e.g., https://github.com/user/repo): " GIT_REPO
read -p "Enter branch name (default: main): " BRANCH
BRANCH=${BRANCH:-main}

read -p "Enter AWS region (default: us-east-1): " REGION
REGION=${REGION:-us-east-1}

read -p "Enter Cognito User Pool ID: " USER_POOL_ID
read -p "Enter Cognito Client ID: " CLIENT_ID

echo ""
echo -e "${YELLOW}⚠️  Note: You'll need to deploy the backend separately${NC}"
echo "Backend deployment options:"
echo "  1. Lambda (recommended) - Use SAM template"
echo "  2. EC2 - Use existing EC2 setup"
echo "  3. ECS Fargate - Use ECS deployment guide"
echo ""

read -p "Do you have a backend API URL? (leave empty if not yet): " API_URL

echo ""
echo -e "${BLUE}📋 Summary${NC}"
echo "================================"
echo "Git Repository: $GIT_REPO"
echo "Branch: $BRANCH"
echo "Region: $REGION"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "API URL: ${API_URL:-Not set (will use placeholder)}"
echo ""

read -p "Continue with deployment? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Creating Amplify App...${NC}"

# Create Amplify app
APP_ID=$(aws amplify create-app \
    --name secrets-portal \
    --repository "$GIT_REPO" \
    --platform WEB \
    --region "$REGION" \
    --query 'app.appId' \
    --output text)

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Failed to create Amplify app${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Amplify app created: ${APP_ID}${NC}"

# Set environment variables
echo ""
echo -e "${BLUE}⚙️  Setting environment variables...${NC}"

ENV_VARS="VITE_USER_POOL_ID=${USER_POOL_ID},VITE_CLIENT_ID=${CLIENT_ID}"
if [ -n "$API_URL" ]; then
    ENV_VARS="${ENV_VARS},VITE_API_URL=${API_URL}"
else
    ENV_VARS="${ENV_VARS},VITE_API_URL=https://api.placeholder.com"
fi

aws amplify update-app \
    --app-id "$APP_ID" \
    --environment-variables "$ENV_VARS" \
    --region "$REGION" \
    > /dev/null

echo -e "${GREEN}✅ Environment variables set${NC}"

# Create branch
echo ""
echo -e "${BLUE}🌿 Creating branch: ${BRANCH}...${NC}"

aws amplify create-branch \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH" \
    --region "$REGION" \
    > /dev/null

echo -e "${GREEN}✅ Branch created${NC}"

# Start deployment
echo ""
echo -e "${BLUE}🚀 Starting deployment...${NC}"

JOB_ID=$(aws amplify start-job \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH" \
    --job-type RELEASE \
    --region "$REGION" \
    --query 'jobSummary.jobId' \
    --output text)

echo -e "${GREEN}✅ Deployment started (Job ID: ${JOB_ID})${NC}"

# Get app URL
APP_URL="https://${BRANCH}.${APP_ID}.amplifyapp.com"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment initiated successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Details:${NC}"
echo "  App ID: ${APP_ID}"
echo "  Branch: ${BRANCH}"
echo "  Job ID: ${JOB_ID}"
echo "  App URL: ${APP_URL}"
echo ""
echo -e "${YELLOW}⏳ Deployment in progress...${NC}"
echo ""
echo "Monitor deployment:"
echo "  1. AWS Console: https://console.aws.amazon.com/amplify/home?region=${REGION}#/${APP_ID}"
echo "  2. CLI: aws amplify get-job --app-id ${APP_ID} --branch-name ${BRANCH} --job-id ${JOB_ID} --region ${REGION}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Wait for deployment to complete (~2-3 minutes)"
echo "  2. Deploy backend (Lambda/EC2/ECS)"
echo "  3. Update API_URL environment variable if needed:"
echo "     aws amplify update-app --app-id ${APP_ID} --environment-variables VITE_API_URL=YOUR_API_URL --region ${REGION}"
echo "  4. Redeploy frontend:"
echo "     aws amplify start-job --app-id ${APP_ID} --branch-name ${BRANCH} --job-type RELEASE --region ${REGION}"
echo ""
echo -e "${GREEN}🎉 Once deployed, access your app at: ${APP_URL}${NC}"
echo ""

# Save details to file
cat > amplify-deployment-info.txt <<EOF
Secrets Portal - Amplify Deployment Info
=========================================

App ID: ${APP_ID}
Branch: ${BRANCH}
Region: ${REGION}
App URL: ${APP_URL}
Job ID: ${JOB_ID}

User Pool ID: ${USER_POOL_ID}
Client ID: ${CLIENT_ID}
API URL: ${API_URL:-Not set}

Deployment Date: $(date)

Useful Commands:
----------------
# Check deployment status
aws amplify get-job --app-id ${APP_ID} --branch-name ${BRANCH} --job-id ${JOB_ID} --region ${REGION}

# Update environment variables
aws amplify update-app --app-id ${APP_ID} --environment-variables VITE_API_URL=YOUR_API_URL,VITE_USER_POOL_ID=${USER_POOL_ID},VITE_CLIENT_ID=${CLIENT_ID} --region ${REGION}

# Trigger new deployment
aws amplify start-job --app-id ${APP_ID} --branch-name ${BRANCH} --job-type RELEASE --region ${REGION}

# Delete app (if needed)
aws amplify delete-app --app-id ${APP_ID} --region ${REGION}

Console URL:
https://console.aws.amazon.com/amplify/home?region=${REGION}#/${APP_ID}
EOF

echo -e "${GREEN}✅ Deployment info saved to: amplify-deployment-info.txt${NC}"
