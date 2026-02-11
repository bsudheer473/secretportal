# New AWS Account Deployment Checklist

Use this checklist to deploy Secrets Portal to a new AWS account.

**Time**: 2-3 hours  
**Cost**: $44-60/month

---

## ✅ Pre-Deployment Checklist

- [ ] AWS Account created and accessible
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Node.js 18+ installed
- [ ] Deployment package downloaded (`secrets-portal-deployment.tar.gz`)
- [ ] Have 2-3 hours available

---

## 📋 Deployment Steps

### Phase 1: AWS Infrastructure (30 min)

- [ ] **Create DynamoDB Tables** (5 min)
  - [ ] secrets-metadata
  - [ ] secrets-audit-log
  - [ ] aws-console-changes
  - Verify: `aws dynamodb list-tables`

- [ ] **Create Cognito User Pool** (10 min)
  - [ ] Create user pool
  - [ ] Create user pool client
  - [ ] Save USER_POOL_ID and CLIENT_ID
  - [ ] Create groups (secrets-admin, app-developer, app-prod-viewer)
  - [ ] Create admin user
  - Verify: `aws cognito-idp list-user-pools --max-results 10`

- [ ] **Create EC2 Instance** (15 min)
  - [ ] Create security group (ports 80, 443, 22)
  - [ ] Create key pair
  - [ ] Launch t3.small instance (Ubuntu 22.04)
  - [ ] Note public IP address
  - [ ] Create IAM role with DynamoDB + Secrets Manager access
  - [ ] Attach IAM role to EC2
  - Verify: `aws ec2 describe-instances`

---

### Phase 2: EC2 Setup (20 min)

- [ ] **SSH into EC2** 
  - `ssh -i secrets-portal-key.pem ubuntu@PUBLIC_IP`

- [ ] **Install Dependencies**
  - [ ] Update system: `sudo apt-get update && sudo apt-get upgrade -y`
  - [ ] Install Node.js 18
  - [ ] Install PM2: `sudo npm install -g pm2`
  - [ ] Install Nginx: `sudo apt-get install -y nginx`

- [ ] **Create Directories**
  - [ ] `mkdir -p ~/packages/backend-express`
  - [ ] `sudo mkdir -p /var/www/secrets-portal`

---

### Phase 3: Deploy Backend (30 min)

- [ ] **Copy Backend Files** (from local machine)
  - [ ] Copy dist folder
  - [ ] Copy package.json
  - `scp -i secrets-portal-key.pem -r backend/* ubuntu@PUBLIC_IP:~/packages/backend-express/`

- [ ] **Configure Backend** (on EC2)
  - [ ] `cd ~/packages/backend-express`
  - [ ] Install dependencies: `npm ci --only=production`
  - [ ] Create .env file with all variables
  - [ ] Test .env: `cat .env`

- [ ] **Start Backend**
  - [ ] Load env: `export $(cat .env | xargs)`
  - [ ] Start PM2: `pm2 start dist/server.js --name secrets-api`
  - [ ] Save PM2: `pm2 save`
  - [ ] Setup startup: `pm2 startup`
  - Verify: `pm2 status` (should show "online")

- [ ] **Test Backend**
  - [ ] `curl http://localhost:3000/api/secrets/applications`
  - Should return auth error (expected)

---

### Phase 4: Deploy Frontend (20 min)

- [ ] **Copy Frontend Files** (from local machine)
  - `scp -i secrets-portal-key.pem -r frontend/* ubuntu@PUBLIC_IP:~/frontend-temp/`

- [ ] **Configure Nginx** (on EC2)
  - [ ] Create Nginx config at `/etc/nginx/sites-available/secrets-portal`
  - [ ] Copy frontend files: `sudo cp -r ~/frontend-temp/* /var/www/secrets-portal/`
  - [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/secrets-portal /etc/nginx/sites-enabled/`
  - [ ] Remove default: `sudo rm /etc/nginx/sites-enabled/default`
  - [ ] Test config: `sudo nginx -t`
  - [ ] Restart Nginx: `sudo systemctl restart nginx`
  - Verify: `sudo systemctl status nginx` (should be active)

- [ ] **Test Frontend**
  - Open browser: `http://PUBLIC_IP`
  - Should see login page

---

### Phase 5: Testing (30 min)

- [ ] **Login Test**
  - [ ] Login with admin@example.com
  - [ ] Change temporary password
  - [ ] Should see dashboard

- [ ] **Create Secret Test**
  - [ ] Click "Create Secret"
  - [ ] Fill form (name, app, env, value)
  - [ ] Submit
  - [ ] Should see success message

- [ ] **List Secrets Test**
  - [ ] Go to Secrets list
  - [ ] Should see created secret
  - [ ] Test filters (application, environment)

- [ ] **Update Secret Test**
  - [ ] Click on a secret
  - [ ] Update value
  - [ ] Should see success

- [ ] **Permissions Test**
  - [ ] Create non-admin user
  - [ ] Add to webapp-developer group
  - [ ] Login as that user
  - [ ] Should only see webapp secrets

---

### Phase 6: Post-Deployment (30 min)

- [ ] **Create Additional Users**
  - [ ] Create users for each application team
  - [ ] Add to appropriate groups
  - [ ] Test each user's access

- [ ] **Setup Monitoring**
  - [ ] Check CloudWatch logs
  - [ ] Setup billing alerts
  - [ ] Setup CloudWatch alarms

- [ ] **Backup Configuration**
  - [ ] Save all IDs (USER_POOL_ID, CLIENT_ID, etc.)
  - [ ] Document EC2 IP address
  - [ ] Save .env file securely

- [ ] **Optional: Teams Notifications**
  - [ ] Create Power Automate flow
  - [ ] Update .env with webhook URL
  - [ ] Test notification

---

## 📊 Verification Checklist

### Infrastructure
- [ ] DynamoDB tables exist and accessible
- [ ] Cognito user pool created with groups
- [ ] EC2 instance running
- [ ] Security groups configured correctly
- [ ] IAM role attached to EC2

### Application
- [ ] Backend API responding (check PM2 status)
- [ ] Frontend loading in browser
- [ ] Nginx proxying API requests correctly
- [ ] No errors in PM2 logs
- [ ] No errors in Nginx logs

### Functionality
- [ ] Can login with admin user
- [ ] Can create secrets
- [ ] Can list secrets
- [ ] Can update secrets
- [ ] Can view audit logs
- [ ] Filters work (application, environment)
- [ ] Permissions work (non-admin users see limited data)

---

## 🆘 Common Issues

### Issue: Backend won't start
**Check**: PM2 logs (`pm2 logs secrets-api`)  
**Fix**: Verify .env file has all required variables

### Issue: Frontend shows 502 error
**Check**: Backend is running (`pm2 status`)  
**Fix**: Restart backend (`pm2 restart secrets-api`)

### Issue: Can't login
**Check**: Cognito user exists  
**Fix**: Create user and add to group

### Issue: "Failed to fetch secrets"
**Check**: Backend logs for errors  
**Fix**: Verify DynamoDB tables exist and IAM role has access

---

## 📝 Important Information to Save

```
AWS Account ID: _______________
Region: us-east-1
User Pool ID: _______________
Client ID: _______________
EC2 Instance ID: _______________
Public IP: _______________
Security Group ID: _______________
IAM Role: SecretsPortalEC2Role

Admin Email: admin@example.com
Admin Password: (set on first login)

Access URL: http://PUBLIC_IP
```

---

## 🎯 Success Criteria

✅ Can access portal at http://PUBLIC_IP  
✅ Can login with admin credentials  
✅ Can create, view, update secrets  
✅ Non-admin users see only their applications  
✅ Audit logs are being recorded  
✅ No errors in logs  

---

## 📚 Reference Documents

- **COMPLETE_DEPLOYMENT_GUIDE.md** - Detailed step-by-step instructions
- **AUTHENTICATION_GUIDE.md** - User and group management
- **AWS_COST_BREAKDOWN.md** - Cost analysis and optimization
- **QUICK_LOGIN_CREDENTIALS.txt** - Test user credentials

---

## Summary

**Total Time**: 2-3 hours  
**Monthly Cost**: $44-60  
**Difficulty**: Medium  

**You'll have**:
- Fully functional Secrets Manager Portal
- Group-based access control
- Audit logging
- Dynamic application/environment dropdowns
- Ready for production use

**Next Steps After Deployment**:
1. Setup custom domain (Route53)
2. Add SSL certificate
3. Configure Teams notifications
4. Create users for your teams
5. Import existing secrets

Good luck with your deployment! 🚀
