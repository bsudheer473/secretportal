# AWS Amplify Deployment Guide

Complete guide to deploy Secrets Portal using AWS Amplify for frontend hosting.

**Last Updated**: January 2026  
**Region**: US East (N. Virginia) - us-east-1

---

## 🎯 What is AWS Amplify?

AWS Amplify is a fully managed service for hosting static web apps with:
- ✅ Automatic CI/CD from Git
- ✅ Built-in CDN (CloudFront)
- ✅ Free SSL certificates
- ✅ Custom domain support
- ✅ Automatic builds on Git push
- ✅ Preview environments for branches
- ✅ Zero server management

---

## 💰 Cost Comparison with Amplify

### Option 1: Amplify Frontend + Lambda Backend (Serverless)

| Component | Specification | Monthly Cost | Notes |
|-----------|--------------|--------------|-------|
| **Amplify Hosting** | Build + hosting | $0.50 | 1 build/day, 5GB storage, 15GB transfer |
| **API Gateway** | REST API | $3.50 | 1M requests |
| **Lambda** | Backend functions | $0.40 | 1M requests, 512MB |
| **DynamoDB** | 200 items | $2.00 | On-demand |
| **Secrets Manager** | 150 secrets | $60.00 | $0.40/secret |
| **Cognito** | 20 users | $0.00 | Free tier |
| **CloudWatch** | Logs + metrics | $3.20 | Minimal logging |
| **SNS** | Notifications | $0.02 | 1K emails |
| **EventBridge** | Events | $0.01 | 10K events |
| **Total** | | **$69.63/month** | **$836/year** |

### Option 2: Amplify Frontend + EC2 Backend

| Component | Specification | Monthly Cost | Notes |
|-----------|--------------|--------------|-------|
| **Amplify Hosting** | Build + hosting | $0.50 | Frontend only |
| **EC2 t3.small** | Backend API | $15.20 | On-demand |
| **EBS Storage** | 30 GB | $2.40 | Backend storage |
| **DynamoDB** | 200 items | $2.00 | On-demand |
| **Secrets Manager** | 150 secrets | $60.00 | $0.40/secret |
| **Cognito** | 20 users | $0.00 | Free tier |
| **CloudWatch** | Logs + metrics | $3.20 | Minimal logging |
| **SNS** | Notifications | $0.02 | 1K emails |
| **EventBridge** | Events | $0.01 | 10K events |
| **Lambda** | Rotation checker | $0.15 | Scheduled function |
| **Total** | | **$83.48/month** | **$1,002/year** |

### Option 3: Current EC2 Setup (No Amplify)

| Component | Monthly Cost |
|-----------|--------------|
| EC2 + Route53 | $84.18 |

**Comparison**:
- **Amplify + Lambda**: $69.63/month ✅ Cheapest, fully serverless
- **Amplify + EC2**: $83.48/month (similar to current)
- **EC2 only**: $84.18/month

**Savings with Amplify + Lambda**: $14.55/month ($175/year)


---

## 🏗️ Architecture Options

### Architecture 1: Amplify + API Gateway + Lambda (Fully Serverless)

```
Route53 (Optional - Custom Domain)
    ↓
AWS Amplify (Frontend - React App)
    ↓
API Gateway (REST API)
    ↓
Lambda Functions (Backend Logic)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Pros**:
- ✅ Fully serverless (no servers to manage)
- ✅ Auto-scaling (handles any traffic)
- ✅ Pay per request (cost-effective for low traffic)
- ✅ Global CDN (fast worldwide)
- ✅ Automatic HTTPS
- ✅ CI/CD built-in

**Cons**:
- ❌ Cold starts (first request slower)
- ❌ API Gateway costs add up at scale
- ❌ More complex debugging

**Best for**: Low to medium traffic, variable usage patterns

---

### Architecture 2: Amplify + EC2 Backend

```
Route53 (Optional - Custom Domain)
    ↓
AWS Amplify (Frontend - React App)
    ↓
EC2 Instance (Express Backend)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Pros**:
- ✅ Consistent performance (no cold starts)
- ✅ Simpler backend (Express.js)
- ✅ Easier debugging
- ✅ Frontend gets Amplify benefits

**Cons**:
- ❌ Still need to manage EC2
- ❌ Fixed cost regardless of usage

**Best for**: Consistent traffic, prefer Express over Lambda

---

### Architecture 3: Amplify + ALB + ECS Fargate

```
Route53 (Optional - Custom Domain)
    ↓
AWS Amplify (Frontend - React App)
    ↓
Application Load Balancer
    ↓
ECS Fargate (Backend Containers)
    ↓
DynamoDB + Secrets Manager + Cognito
```

**Pros**:
- ✅ Frontend on Amplify (easy deployment)
- ✅ Backend on containers (flexible)
- ✅ Auto-scaling backend
- ✅ No cold starts

**Cons**:
- ❌ Higher cost (ALB + Fargate)
- ❌ More complex setup

**Best for**: Need container flexibility with easy frontend deployment

---

## 🚀 Deployment Guide - Amplify + Lambda (Recommended)

### Prerequisites

- Git repository (GitHub, GitLab, Bitbucket, or CodeCommit)
- AWS account
- AWS CLI configured

### Step 1: Prepare Frontend for Amplify

```bash
# Navigate to frontend directory
cd packages/frontend

# Update API endpoint to use API Gateway
# Edit src/config.ts or .env file
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod

# Build to verify
npm run build
```

### Step 2: Push Code to Git Repository

```bash
# Initialize git if not already
git init
git add .
git commit -m "Initial commit"

# Push to GitHub/GitLab/etc
git remote add origin https://github.com/your-org/secrets-portal.git
git push -u origin main
```

### Step 3: Create Amplify App

```bash
# Option A: Using AWS Console (Easier)
# 1. Go to AWS Amplify Console
# 2. Click "New app" → "Host web app"
# 3. Connect your Git repository
# 4. Select branch (main)
# 5. Configure build settings (see below)
# 6. Deploy

# Option B: Using AWS CLI
aws amplify create-app \
  --name secrets-portal \
  --repository https://github.com/your-org/secrets-portal \
  --platform WEB \
  --region us-east-1
```

### Step 4: Configure Build Settings

Create `amplify.yml` in your repository root:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd packages/frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: packages/frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - packages/frontend/node_modules/**/*
```

### Step 5: Deploy Backend Lambda Functions

```bash
# Navigate to backend directory
cd packages/backend

# Install dependencies
npm ci

# Build
npm run build

# Deploy using AWS SAM or Serverless Framework
# See backend deployment section below
```

### Step 6: Create API Gateway

```bash
# Create REST API
aws apigateway create-rest-api \
  --name secrets-portal-api \
  --description "Secrets Portal API" \
  --region us-east-1

# Get API ID
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='secrets-portal-api'].id" \
  --output text)

# Create resources and methods
# (See detailed API Gateway setup below)
```

### Step 7: Configure Environment Variables in Amplify

```bash
# Set environment variables for frontend build
aws amplify update-app \
  --app-id YOUR_APP_ID \
  --environment-variables \
    VITE_API_URL=https://$API_ID.execute-api.us-east-1.amazonaws.com/prod \
    VITE_USER_POOL_ID=us-east-1_XXXXXXXXX \
    VITE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx \
  --region us-east-1
```

### Step 8: Setup Custom Domain (Optional)

```bash
# Add custom domain
aws amplify create-domain-association \
  --app-id YOUR_APP_ID \
  --domain-name secrets.yourdomain.com \
  --sub-domain-settings prefix=www,branchName=main \
  --region us-east-1

# Update DNS records in Route53
# Amplify will provide CNAME records to add
```


---

## 📦 Backend Deployment Options

### Option A: Lambda with SAM (Recommended)

Create `template.yaml` in backend directory:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Secrets Portal Backend

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs18.x
    Environment:
      Variables:
        USER_POOL_ID: !Ref UserPoolId
        CLIENT_ID: !Ref ClientId
        DYNAMODB_TABLE: secrets-metadata
        AUDIT_TABLE: secrets-audit-log

Parameters:
  UserPoolId:
    Type: String
    Description: Cognito User Pool ID
  ClientId:
    Type: String
    Description: Cognito Client ID

Resources:
  # API Gateway
  SecretsApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'Content-Type,Authorization'"
        AllowOrigin: "'*'"
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            UserPoolArn: !Sub 'arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/${UserPoolId}'

  # List Secrets Function
  ListSecretsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handlers/secrets.listSecrets
      Policies:
        - DynamoDBReadPolicy:
            TableName: secrets-metadata
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:ListSecrets
                - secretsmanager:DescribeSecret
              Resource: '*'
      Events:
        ListSecrets:
          Type: Api
          Properties:
            RestApiId: !Ref SecretsApi
            Path: /api/secrets
            Method: GET

  # Get Secret Function
  GetSecretFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handlers/secrets.getSecret
      Policies:
        - DynamoDBReadPolicy:
            TableName: secrets-metadata
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:GetSecretValue
              Resource: '*'
      Events:
        GetSecret:
          Type: Api
          Properties:
            RestApiId: !Ref SecretsApi
            Path: /api/secrets/{secretName}
            Method: GET

  # Create Secret Function
  CreateSecretFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handlers/secrets.createSecret
      Policies:
        - DynamoDBCrudPolicy:
            TableName: secrets-metadata
        - DynamoDBCrudPolicy:
            TableName: secrets-audit-log
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:CreateSecret
                - secretsmanager:TagResource
              Resource: '*'
      Events:
        CreateSecret:
          Type: Api
          Properties:
            RestApiId: !Ref SecretsApi
            Path: /api/secrets
            Method: POST

  # Update Secret Function
  UpdateSecretFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handlers/secrets.updateSecret
      Policies:
        - DynamoDBCrudPolicy:
            TableName: secrets-metadata
        - DynamoDBCrudPolicy:
            TableName: secrets-audit-log
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:UpdateSecret
                - secretsmanager:PutSecretValue
              Resource: '*'
      Events:
        UpdateSecret:
          Type: Api
          Properties:
            RestApiId: !Ref SecretsApi
            Path: /api/secrets/{secretName}
            Method: PUT

  # Delete Secret Function
  DeleteSecretFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handlers/secrets.deleteSecret
      Policies:
        - DynamoDBCrudPolicy:
            TableName: secrets-metadata
        - DynamoDBCrudPolicy:
            TableName: secrets-audit-log
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:DeleteSecret
              Resource: '*'
      Events:
        DeleteSecret:
          Type: Api
          Properties:
            RestApiId: !Ref SecretsApi
            Path: /api/secrets/{secretName}
            Method: DELETE

  # Rotation Checker Function (Scheduled)
  RotationCheckerFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handlers/rotation-checker.handler
      Policies:
        - DynamoDBReadPolicy:
            TableName: secrets-metadata
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:DescribeSecret
                - sns:Publish
              Resource: '*'
      Events:
        DailyCheck:
          Type: Schedule
          Properties:
            Schedule: 'cron(0 9 * * ? *)'  # 9 AM daily

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${SecretsApi}.execute-api.${AWS::Region}.amazonaws.com/prod'
  ApiId:
    Description: API Gateway ID
    Value: !Ref SecretsApi
```

Deploy with SAM:

```bash
# Build
cd packages/backend
npm run build
sam build

# Deploy
sam deploy \
  --stack-name secrets-portal-backend \
  --parameter-overrides \
    UserPoolId=us-east-1_XXXXXXXXX \
    ClientId=xxxxxxxxxxxxxxxxxxxxxxxxxx \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Get API URL
sam list stack-outputs \
  --stack-name secrets-portal-backend \
  --output table
```


---

## 🔧 Converting Express Backend to Lambda

Your current Express backend can be converted to Lambda using `aws-serverless-express`:

### Step 1: Install Dependencies

```bash
cd packages/backend-express
npm install aws-serverless-express @vendia/serverless-express
```

### Step 2: Create Lambda Handler

Create `lambda.ts`:

```typescript
import serverlessExpress from '@vendia/serverless-express';
import { app } from './server';  // Your Express app

let serverlessExpressInstance: any;

async function setup(event: any, context: any) {
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

export const handler = (event: any, context: any) => {
  if (serverlessExpressInstance) {
    return serverlessExpressInstance(event, context);
  }
  return setup(event, context);
};
```

### Step 3: Update server.ts

Separate app creation from server start:

```typescript
// server.ts
import express from 'express';
import cors from 'cors';
import secretsRouter from './routes/secrets';

export const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/secrets', secretsRouter);

// Only start server if not in Lambda
if (process.env.AWS_EXECUTION_ENV === undefined) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

### Step 4: Create SAM Template for Express

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  ExpressBackend:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: lambda.handler
      Runtime: nodejs18.x
      MemorySize: 512
      Timeout: 30
      Environment:
        Variables:
          USER_POOL_ID: !Ref UserPoolId
          CLIENT_ID: !Ref ClientId
      Policies:
        - DynamoDBCrudPolicy:
            TableName: secrets-metadata
        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:*
              Resource: '*'
      Events:
        ProxyApi:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
```

---

## 💰 Detailed Cost Breakdown - Amplify Solution

### Amplify Hosting Costs

| Metric | Usage | Cost | Notes |
|--------|-------|------|-------|
| **Build minutes** | 30 builds/month × 5 min | $0.00 | First 1,000 min free |
| **Hosting** | 5 GB storage | $0.00 | First 5 GB free |
| **Data transfer** | 15 GB/month | $0.00 | First 15 GB free |
| **Total Amplify** | | **$0.00** | Within free tier! |

**Note**: If you exceed free tier:
- Build minutes: $0.01/minute after 1,000
- Storage: $0.023/GB/month after 5 GB
- Data transfer: $0.15/GB after 15 GB

### API Gateway Costs

| Metric | Usage | Cost | Notes |
|--------|-------|------|-------|
| **API calls** | 1M requests/month | $3.50 | $3.50 per million |
| **Data transfer** | 10 GB out | $0.00 | First 100 GB free |
| **Total API Gateway** | | **$3.50** | |

### Lambda Costs

| Metric | Usage | Cost | Notes |
|--------|-------|------|-------|
| **Requests** | 1M/month | $0.20 | $0.20 per million |
| **Duration** | 10K GB-seconds | $0.17 | $0.0000166667/GB-second |
| **Total Lambda** | | **$0.37** | |

**Free tier**: 1M requests + 400K GB-seconds/month (permanent)

### Total Monthly Cost - Amplify + Lambda

| Component | Cost |
|-----------|------|
| Amplify Hosting | $0.00 |
| API Gateway | $3.50 |
| Lambda | $0.37 |
| DynamoDB | $2.00 |
| Secrets Manager | $60.00 |
| Cognito | $0.00 |
| CloudWatch | $3.20 |
| SNS | $0.02 |
| EventBridge | $0.01 |
| **Total** | **$69.10/month** |

**Annual**: $829

---

## 📊 Cost Comparison Summary

| Solution | Monthly | Annual | Maintenance | Best For |
|----------|---------|--------|-------------|----------|
| **Amplify + Lambda** | **$69.10** | **$829** | Minimal | Low traffic, serverless |
| **Amplify + EC2** | $83.48 | $1,002 | Medium | Consistent traffic |
| **EC2 + Route53** | $84.18 | $1,010 | High | Internal only |
| **EC2 + ALB** | $99.88 | $1,199 | High | Public access |
| **ECS Fargate** | $100.28 | $1,203 | Low | Auto-scaling |

**Winner**: Amplify + Lambda at **$69.10/month** ✅

**Savings vs current EC2**: $15.08/month ($181/year)


---

## ✅ Pros and Cons

### Amplify + Lambda

**Pros**:
- ✅ **Lowest cost** ($69/month)
- ✅ **Zero server management**
- ✅ **Auto-scaling** (handles any traffic)
- ✅ **Global CDN** (fast worldwide)
- ✅ **CI/CD built-in** (auto-deploy on git push)
- ✅ **Free SSL** certificates
- ✅ **Preview environments** for branches
- ✅ **Pay per request** (cost-effective for low traffic)

**Cons**:
- ❌ **Cold starts** (first request 1-3 seconds slower)
- ❌ **Lambda limits** (15 min timeout, 10 GB memory max)
- ❌ **More complex debugging** than Express
- ❌ **API Gateway costs** add up at very high scale
- ❌ **Requires code changes** (Express → Lambda)

**Best for**:
- Internal tools with variable usage
- Low to medium traffic (< 10M requests/month)
- Teams that want minimal maintenance
- Projects that benefit from CI/CD

---

### Amplify + EC2

**Pros**:
- ✅ **Frontend benefits** (Amplify CI/CD, CDN)
- ✅ **No cold starts** (consistent performance)
- ✅ **Keep Express backend** (no code changes)
- ✅ **Easier debugging** than Lambda
- ✅ **No Lambda limits**

**Cons**:
- ❌ **Still manage EC2** (patching, monitoring)
- ❌ **Fixed cost** regardless of usage
- ❌ **Single point of failure** (unless multi-AZ)
- ❌ **Manual scaling**

**Best for**:
- Want Amplify frontend benefits
- Prefer Express over Lambda
- Consistent 24/7 traffic
- Have DevOps resources

---

## 🎯 Decision Matrix

### Choose Amplify + Lambda If:

✅ Want **lowest cost** ($69/month)  
✅ Want **zero server management**  
✅ Have **variable or low traffic** (< 1M requests/day)  
✅ Can tolerate **cold starts** (1-3 seconds)  
✅ Want **automatic CI/CD** from Git  
✅ Want **global CDN** for fast loading  
✅ Willing to **convert Express to Lambda**  

**Setup time**: 2-3 hours  
**Maintenance**: < 1 hour/month

---

### Choose Amplify + EC2 If:

✅ Want **Amplify frontend benefits**  
✅ Want to **keep Express backend** (no changes)  
✅ Need **consistent performance** (no cold starts)  
✅ Have **steady 24/7 traffic**  
✅ Have **DevOps resources** for EC2 management  

**Setup time**: 2-3 hours  
**Maintenance**: 4-6 hours/month

---

### Choose EC2 Only (Current) If:

✅ Want **simplest setup** (all in one place)  
✅ **Internal use only** (no public access needed)  
✅ Don't need **CI/CD** automation  
✅ Comfortable with **manual deployments**  

**Setup time**: 1-2 hours  
**Maintenance**: 6-8 hours/month

---

## 🚀 Quick Start - Amplify + Lambda

### 1. Push Code to Git

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/secrets-portal.git
git push -u origin main
```

### 2. Create Amplify App (AWS Console)

1. Go to **AWS Amplify Console**
2. Click **"New app"** → **"Host web app"**
3. Connect **GitHub/GitLab/Bitbucket**
4. Select repository and branch
5. Build settings:
   - Build command: `cd packages/frontend && npm ci && npm run build`
   - Base directory: `packages/frontend`
   - Output directory: `dist`
6. Click **"Save and deploy"**

### 3. Deploy Backend with SAM

```bash
# Install SAM CLI
brew install aws-sam-cli  # macOS
# or
pip install aws-sam-cli   # Python

# Navigate to backend
cd packages/backend

# Build
npm run build
sam build

# Deploy
sam deploy --guided

# Note the API URL from outputs
```

### 4. Update Frontend Environment Variables

In Amplify Console:
1. Go to **App settings** → **Environment variables**
2. Add:
   - `VITE_API_URL`: Your API Gateway URL
   - `VITE_USER_POOL_ID`: Your Cognito User Pool ID
   - `VITE_CLIENT_ID`: Your Cognito Client ID
3. **Redeploy** frontend

### 5. Test

```bash
# Get Amplify URL
aws amplify get-app --app-id YOUR_APP_ID

# Open in browser
open https://main.YOUR_APP_ID.amplifyapp.com
```

---

## 🔄 CI/CD Workflow with Amplify

### Automatic Deployments

```
Developer pushes to Git
    ↓
Amplify detects change
    ↓
Runs build (npm ci && npm run build)
    ↓
Deploys to CDN
    ↓
App live in ~2-3 minutes
```

### Branch Deployments

```bash
# Create feature branch
git checkout -b feature/new-ui

# Make changes and push
git push origin feature/new-ui

# Amplify automatically creates preview environment
# Access at: https://feature-new-ui.YOUR_APP_ID.amplifyapp.com
```

### Environment Variables per Branch

```bash
# Production (main branch)
VITE_API_URL=https://api.prod.example.com

# Staging (develop branch)
VITE_API_URL=https://api.staging.example.com

# Feature branches
VITE_API_URL=https://api.dev.example.com
```

---

## 📈 Scaling Considerations

### When to Stay with Amplify + Lambda

- ✅ < 10M requests/month
- ✅ Variable traffic patterns
- ✅ Cost is priority
- ✅ Team size < 10 people

**Cost at scale**:
- 10M requests/month: ~$100/month
- 50M requests/month: ~$250/month

### When to Migrate to ECS/Fargate

- ❌ > 50M requests/month
- ❌ Need sub-100ms response times
- ❌ Complex long-running operations
- ❌ Need WebSocket support

**Migration path**: Amplify frontend stays, backend moves to ECS

---

## 🎯 Recommendation

**For your use case (internal secrets portal, 20-50 users, 150 secrets)**:

### Best Option: **Amplify + Lambda**

**Why**:
1. **Lowest cost**: $69/month vs $84/month (saves $180/year)
2. **Minimal maintenance**: < 1 hour/month vs 6-8 hours
3. **Auto-scaling**: Handles traffic spikes automatically
4. **CI/CD**: Deploy on git push (no manual steps)
5. **Global CDN**: Fast loading worldwide
6. **Free SSL**: Automatic HTTPS

**Trade-offs**:
- Cold starts (1-3 seconds on first request)
- Need to convert Express to Lambda (2-3 hours work)

**ROI**: 
- Time saved: 5-7 hours/month maintenance
- Cost saved: $15/month
- **Total value**: ~$400-600/month (time + cost)

### Alternative: **Amplify + EC2**

If you don't want to convert to Lambda:
- Keep Express backend on EC2
- Use Amplify for frontend only
- Cost: $83/month (similar to current)
- Still get CI/CD benefits for frontend

---

## Summary

✅ **AWS Amplify is perfect for this solution!**

**Recommended architecture**: Amplify (frontend) + Lambda (backend)

**Benefits**:
- Lowest cost: **$69/month**
- Zero server management
- Automatic CI/CD
- Global CDN
- Free SSL

**Setup**: 2-3 hours one-time  
**Maintenance**: < 1 hour/month  
**Savings**: $180/year + 60 hours/year

**Next steps**:
1. Push code to Git repository
2. Create Amplify app (10 minutes)
3. Deploy backend with SAM (30 minutes)
4. Configure environment variables (5 minutes)
5. Test and go live! 🚀

