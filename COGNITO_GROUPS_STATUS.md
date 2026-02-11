# Cognito Groups Status

**User Pool ID**: `us-east-1_O9Yt0QiW0`  
**User Pool Name**: `secrets-portal-users`

---

## ✅ Groups Created

### Admin Group
- `secrets-admin` - Full access to all secrets

### Real Application Groups (NEWLY CREATED)
- `webapp-developer` - Read/write webapp NP/PP ✅
- `webapp-prod-viewer` - Read-only webapp Prod ✅
- `api-service-developer` - Read/write api-service NP/PP ✅
- `api-service-prod-viewer` - Read-only api-service Prod ✅
- `windows-developer` - Read/write windows NP/PP ✅
- `windows-prod-viewer` - Read-only windows Prod ✅

### Legacy Placeholder Groups (from CDK)
- `app1-developer`, `app1-prod-viewer`
- `app2-developer`, `app2-prod-viewer`
- `app3-developer`, `app3-prod-viewer`
- `app4-developer`, `app4-prod-viewer`
- `app5-developer`, `app5-prod-viewer`
- `app6-developer`, `app6-prod-viewer`

---

## 📊 Current Applications in DynamoDB

Based on secrets-metadata table scan:
1. **webapp** ✅ Groups created
2. **api-service** ✅ Groups created
3. **windows** ✅ Groups created
4. **app1** ✅ Groups exist (legacy)
5. **unknown** ⚠️ No groups (likely test data)

---

## 👥 Existing Users

| Email | Groups | Access |
|-------|--------|--------|
| admin@example.com | secrets-admin | Full access to everything |
| app1-dev@example.com | app1-developer | Read/write app1 NP/PP |
| app1-viewer@example.com | app1-prod-viewer | Read-only app1 Prod |
| app2-dev@example.com | app2-developer | Read/write app2 NP/PP |
| app2-viewer@example.com | app2-prod-viewer | Read-only app2 Prod |
| app3-dev@example.com | app3-developer | Read/write app3 NP/PP |
| app3-viewer@example.com | app3-prod-viewer | Read-only app3 Prod |
| multi-app@example.com | (check groups) | Multiple apps |

---

## 🎯 How to Give webapp Users Access

### For a New User

```bash
# 1. Create user (if doesn't exist)
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username john@company.com \
  --user-attributes Name=email,Value=john@company.com \
  --temporary-password "TempPass123!"

# 2. Add to webapp-developer group (read/write NP & PP)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username john@company.com \
  --group-name webapp-developer

# 3. (Optional) Add to webapp-prod-viewer for Prod read access
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username john@company.com \
  --group-name webapp-prod-viewer
```

### For Existing User

```bash
# Just add them to the webapp groups
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username existing-user@company.com \
  --group-name webapp-developer
```

---

## 🔍 Verify User Access

```bash
# Check what groups a user is in
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username john@company.com

# List all users in a group
aws cognito-idp list-users-in-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --group-name webapp-developer
```

---

## 📝 Next Steps for New Applications

When you add a new application (e.g., "MFT", "FFIN", "TCAST"):

### Option 1: Manual (Immediate)
```bash
# Create groups for the new app
aws cognito-idp create-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --group-name MFT-developer \
  --description "Read/write access to MFT secrets in NP and PP"

aws cognito-idp create-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --group-name MFT-prod-viewer \
  --description "Read-only access to MFT Prod secrets"
```

### Option 2: Update CDK (Permanent)
Update `packages/infrastructure/lib/stacks/authentication-stack.ts`:

```typescript
// Replace this line:
const applications = ['app1', 'app2', 'app3', 'app4', 'app5', 'app6'];

// With your real applications:
const applications = ['webapp', 'api-service', 'windows', 'MFT', 'FFIN', 'TCAST', 'FHCM', 'HRFS'];
```

Then redeploy:
```bash
cd packages/infrastructure
npm run deploy
```

---

## ⚠️ Important Notes

1. **Group names are case-sensitive** - Use lowercase for consistency
2. **Hyphens in app names** - If your app is "api-service", group is "api-service-developer"
3. **No spaces allowed** - Use hyphens instead of spaces
4. **Automatic permission mapping** - Backend automatically extracts app name from group name
5. **No code changes needed** - Just create groups and add users

---

## 🧪 Test Access

### Test webapp User
```bash
# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username webapp-test@test.com \
  --user-attributes Name=email,Value=webapp-test@test.com \
  --temporary-password "TestPass123!"

# Add to webapp-developer
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username webapp-test@test.com \
  --group-name webapp-developer

# Login and verify:
# - Should only see "webapp" in application dropdown
# - Should only see webapp secrets
# - Should be able to create webapp secrets in NP/PP
```

---

## 🔧 Troubleshooting

### User sees no applications
**Problem**: User not in any groups  
**Solution**: Add to appropriate group

### User sees wrong applications
**Problem**: User in wrong groups  
**Solution**: Remove from wrong groups, add to correct ones

### User can't create secrets
**Problem**: User in prod-viewer group (read-only)  
**Solution**: Add to developer group

---

## Summary

✅ **Groups created for real applications**: webapp, api-service, windows  
✅ **Legacy groups exist**: app1-app6 (can be used or ignored)  
✅ **Admin group exists**: secrets-admin  
✅ **Test users exist**: Various app1/app2/app3 users  
✅ **Ready to use**: Just add users to webapp-developer group!

**To give webapp team access:**
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username user@company.com \
  --group-name webapp-developer
```

Done! 🎉
