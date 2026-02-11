# AWS Amplify Deployment - Step by Step Guide

Complete step-by-step instructions to deploy Secrets Portal to AWS Amplify.

**Time Required**: 30-45 minutes  
**Cost**: $69/month (with Lambda backend)

---

## ✅ Prerequisites

Before you start, ensure you have:

- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Git repository (GitHub, GitLab, Bitbucket, or CodeCommit)
- [ ] Node.js 18+ installed
- [ ] Cognito User Pool created (User Pool ID and Client ID)
- [ ] DynamoDB tables created (secrets-metadata, secrets-audit-log)

---

## 🚀 Option 1: Automated Deployment (Recommended)

### Step 1: Make the script executable

```bash
chmod +x deploy-amplify.sh
```

### Step 2: Run the deployment script

```bash
./deploy-amplify.sh
```

The script will:
1. ✅ Check AWS CLI installation
2. ✅ Verify AWS credentials
3. ✅ Prompt for configuration (Git repo, branch, Cognito IDs)
4. ✅ Create Amplify app
5. ✅ Set environment variables
6. ✅ Start deployment
7. ✅ Provide deployment URL and monitoring commands

### Step 3: Wait for deployment

Monitor deployment progress:

```bash
# Check status (use values from script output)
aws amplify get-job \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --job-id YOUR_JOB_ID \
  --region us-east-1
```

Or visit AWS Console:
https://console.aws.amazon.com/amplify/

### Step 4: Access your app

Once deployment completes (~2-3 minutes):
```
https://main.YOUR_APP_ID.amplifyapp.com
```

---

## 🔧 Option 2: Manual Deployment via AWS Console

### Step 1: Push code to Git

```bash
# Initialize git if not already
git init
git add .
git commit -m "Initial commit for Amplify deployment"

# Push to your Git provider
git remote add origin https://github.com/YOUR_USERNAME/secrets-portal.git
git push -u origin main
```

### Step 2: Create Amplify App

1. Go to **AWS Amplify Console**: https://console.aws.amazon.com/amplify/
2. Click **"New app"** → **"Host web app"**
3. Select your Git provider (GitHub/GitLab/Bitbucket/CodeCommit)
4. Authorize AWS Amplify to access your repository
5. Select repository: `secrets-portal`
6. Select branch: `main`
7. Click **"Next"**

### Step 3: Configure Build Settings

The `amplify.yml` file in your repository will be automatically detected.

Verify it shows:
- **Build command**: `cd packages/frontend && npm ci && npm run build`
- **Base directory**: `packages/frontend`
- **Output directory**: `dist`

Click **"Next"**

### Step 4: Add Environment Variables

Click **"Advanced settings"** and add:

| Key | Value |
|-----|-------|
| `VITE_USER_POOL_ID` | `us-east-1_XXXXXXXXX` |
| `VITE_CLIENT_ID` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `VITE_API_URL` | `https://api.yourdomain.com` (or placeholder) |

Click **"Next"**

### Step 5: Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. Wait 2-3 minutes for deployment

### Step 6: Get Your App URL

Once deployed, you'll see:
```
https://main.YOUR_APP_ID.amplifyapp.com
```

---

## 🔧 Option 3: Manual Deployment via AWS CLI

### Step 1: Create Amplify App

```bash
# Set variables
GIT_REPO="https://github.com/YOUR_USERNAME/secrets-portal"
BRANCH="main"
REGION="us-east-1"

# Create app
APP_ID=$(aws amplify create-app \
  --name secrets-portal \
  --repository "$GIT_REPO" \
  --platform WEB \
  --region "$REGION" \
  --query 'app.appId' \
  --output text)

echo "App ID: $APP_ID"
```

### Step 2: Set Environment Variables

```bash
# Replace with your actual values
USER_POOL_ID="us-east-1_XXXXXXXXX"
CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
API_URL="https://api.yourdomain.com"

aws amplify update-app \
  --app-id "$APP_ID" \
  --environment-variables \
    "VITE_USER_POOL_ID=${USER_POOL_ID},VITE_CLIENT_ID=${CLIENT_ID},VITE_API_URL=${API_URL}" \
  --region "$REGION"
```

### Step 3: Create Branch

```bash
aws amplify create-branch \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION"
```

### Step 4: Start Deployment

```bash
JOB_ID=$(aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-type RELEASE \
  --region "$REGION" \
  --query 'jobSummary.jobId' \
  --output text)

echo "Job ID: $JOB_ID"
echo "App URL: https://${BRANCH}.${APP_ID}.amplifyapp.com"
```

### Step 5: Monitor Deployment

```bash
# Check status
aws amplify get-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-id "$JOB_ID" \
  --region "$REGION"

# Watch logs
aws amplify get-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-id "$JOB_ID" \
  --region "$REGION" \
  --query 'job.steps[*].[stepName,status]' \
  --output table
```

---

## 🔗 Connect Custom Domain (Optional)

### Via AWS Console

1. Go to Amplify Console → Your App
2. Click **"Domain management"**
3. Click **"Add domain"**
4. Enter your domain: `secrets.yourdomain.com`
5. Follow DNS configuration instructions
6. Wait for SSL certificate provisioning (~15 minutes)

### Via AWS CLI

```bash
aws amplify create-domain-association \
  --app-id "$APP_ID" \
  --domain-name "yourdomain.com" \
  --sub-domain-settings prefix=secrets,branchName=main \
  --region "$REGION"

# Get DNS records to add
aws amplify get-domain-association \
  --app-id "$APP_ID" \
  --domain-name "yourdomain.com" \
  --region "$REGION"
```

Add the provided CNAME records to your DNS provider.

---

## 🔄 Update Deployment

### Update Environment Variables

```bash
aws amplify update-app \
  --app-id "$APP_ID" \
  --environment-variables \
    "VITE_API_URL=https://new-api-url.com,VITE_USER_POOL_ID=${USER_POOL_ID},VITE_CLIENT_ID=${CLIENT_ID}" \
  --region "$REGION"

# Trigger redeploy
aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-type RELEASE \
  --region "$REGION"
```

### Deploy Code Changes

Just push to Git:

```bash
git add .
git commit -m "Update feature"
git push origin main

# Amplify automatically detects and deploys!
```

---

## 🧪 Testing

### Test Frontend

```bash
# Get app URL
APP_URL="https://main.${APP_ID}.amplifyapp.com"

# Open in browser
open "$APP_URL"  # macOS
# or
xdg-open "$APP_URL"  # Linux
# or visit in browser manually
```

### Test API Connection

1. Open browser developer console (F12)
2. Navigate to your Amplify URL
3. Try to login
4. Check Network tab for API calls
5. Verify calls are going to correct API URL

---

## 🆘 Troubleshooting

### Issue: Build Fails

**Check build logs**:
```bash
aws amplify get-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-id "$JOB_ID" \
  --region "$REGION" \
  --query 'job.steps[*].[stepName,logUrl]' \
  --output table
```

**Common causes**:
- Missing dependencies in package.json
- Build command incorrect in amplify.yml
- Environment variables not set

### Issue: App Loads but API Calls Fail

**Check**:
1. Environment variables are set correctly
2. API URL is accessible
3. CORS is configured on backend
4. Cognito IDs are correct

**Fix**:
```bash
# Update environment variables
aws amplify update-app \
  --app-id "$APP_ID" \
  --environment-variables "VITE_API_URL=CORRECT_URL" \
  --region "$REGION"

# Redeploy
aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-type RELEASE \
  --region "$REGION"
```

### Issue: Can't Access App

**Check**:
```bash
# Verify app exists
aws amplify get-app --app-id "$APP_ID" --region "$REGION"

# Check branch status
aws amplify get-branch \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION"
```

---

## 🗑️ Cleanup (Delete Amplify App)

```bash
# Delete app
aws amplify delete-app \
  --app-id "$APP_ID" \
  --region "$REGION"

# Confirm deletion
aws amplify list-apps --region "$REGION"
```

---

## 📊 Monitoring

### View Deployment History

```bash
aws amplify list-jobs \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --region "$REGION" \
  --max-results 10
```

### View Access Logs

In AWS Console:
1. Go to Amplify → Your App
2. Click **"Monitoring"**
3. View traffic, errors, and performance metrics

---

## 💰 Cost Monitoring

### Check Amplify Usage

```bash
# Get app details
aws amplify get-app \
  --app-id "$APP_ID" \
  --region "$REGION"
```

In AWS Console:
1. Go to **AWS Cost Explorer**
2. Filter by service: **AWS Amplify**
3. View monthly costs

**Expected costs**:
- Build minutes: $0 (first 1,000 free)
- Hosting: $0 (first 5 GB free)
- Data transfer: $0 (first 15 GB free)

**Total**: ~$0-2/month for typical usage

---

## ✅ Success Checklist

- [ ] Amplify app created
- [ ] Environment variables set
- [ ] Build completed successfully
- [ ] App accessible at Amplify URL
- [ ] Can login with Cognito credentials
- [ ] API calls working (if backend deployed)
- [ ] Custom domain configured (optional)
- [ ] Automatic deployments working (git push)

---

## 📝 Next Steps

1. **Deploy Backend**:
   - Option A: Lambda (see AWS_AMPLIFY_DEPLOYMENT.md)
   - Option B: EC2 (see COMPLETE_DEPLOYMENT_GUIDE.md)
   - Option C: ECS (see ECS_NEW_ACCOUNT_DEPLOYMENT.md)

2. **Update API URL**:
   ```bash
   aws amplify update-app \
     --app-id "$APP_ID" \
     --environment-variables "VITE_API_URL=YOUR_BACKEND_URL" \
     --region "$REGION"
   ```

3. **Redeploy Frontend**:
   ```bash
   aws amplify start-job \
     --app-id "$APP_ID" \
     --branch-name "$BRANCH" \
     --job-type RELEASE \
     --region "$REGION"
   ```

4. **Test End-to-End**:
   - Login
   - Create secret
   - View secrets
   - Update secret
   - Check audit logs

---

## Summary

✅ **Frontend deployed to AWS Amplify**  
✅ **Automatic CI/CD from Git**  
✅ **Global CDN for fast loading**  
✅ **Free SSL certificate**  
✅ **Cost: ~$0-2/month**  

**Total deployment time**: 30-45 minutes  
**Maintenance**: < 1 hour/month  

**Your app is live at**: `https://main.YOUR_APP_ID.amplifyapp.com` 🎉

