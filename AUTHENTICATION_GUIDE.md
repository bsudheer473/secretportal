# Authentication & Authorization Guide

## Overview

The Secrets Portal uses **AWS Cognito** for authentication and **group-based permissions** for authorization. Users are assigned to Cognito groups, which determine what applications and environments they can access.

---

## How It Works

### 1. User Authentication Flow

```
User Login → Cognito → JWT Token → Backend validates token → Extract groups → Map to permissions
```

1. **User logs in** via Cognito (email/password)
2. **Cognito returns JWT token** containing user info and groups
3. **Frontend sends token** in Authorization header: `Bearer <token>`
4. **Backend validates token** and extracts `cognito:groups`
5. **Groups are mapped to permissions** (app/env/access level)
6. **API filters data** based on user permissions

---

## Permission Model

### Group Naming Convention

Groups follow this pattern:
- `{application}-developer` → Read/Write access to NP & PP environments
- `{application}-prod-viewer` → Read-only access to Prod environment
- `secrets-admin` → Full access to everything

### Examples

| Cognito Group | Application | Environments | Access Level |
|--------------|-------------|--------------|--------------|
| `webapp-developer` | webapp | NP, PP | Read/Write |
| `webapp-prod-viewer` | webapp | Prod | Read-only |
| `mft-developer` | MFT | NP, PP | Read/Write |
| `mft-prod-viewer` | MFT | Prod | Read-only |
| `secrets-admin` | ALL | ALL | Read/Write |

---

## Setting Up Access for "webapp" Application Users

### Step 1: Create Cognito Groups (if not exists)

You need to create two groups for the "webapp" application:

```bash
# Using AWS CLI

# 1. Create developer group (read/write NP & PP)
aws cognito-idp create-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --group-name webapp-developer \
  --description "Read/write access to webapp secrets in NP and PP environments"

# 2. Create prod viewer group (read-only Prod)
aws cognito-idp create-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --group-name webapp-prod-viewer \
  --description "Read-only access to webapp secrets in Prod environment"
```

### Step 2: Add Users to Groups

```bash
# Add user to webapp-developer group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username john@company.com \
  --group-name webapp-developer

# Add user to webapp-prod-viewer group (if they also need Prod read access)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username john@company.com \
  --group-name webapp-prod-viewer
```

### Step 3: User Logs In

When the user logs in, they will **only see secrets** for the "webapp" application:
- ✅ Can see webapp secrets in NP, PP (read/write)
- ✅ Can see webapp secrets in Prod (read-only if in prod-viewer group)
- ❌ Cannot see MFT, FFIN, or other application secrets
- ❌ Cannot see applications they don't have access to in dropdowns

---

## Permission Mapping Logic

The backend automatically maps Cognito groups to permissions:

```typescript
// From: packages/backend-express/src/middleware/auth.ts

function getUserPermissions(cognitoGroups: string[]): Permission[] {
  const permissions: Permission[] = [];

  for (const group of cognitoGroups) {
    if (group === 'secrets-admin') {
      // Admin: full access to everything
      permissions.push({ app: '*', env: '*', access: 'write' });
    } 
    else if (group.endsWith('-developer')) {
      // Developer: read/write to NP and PP
      const app = group.replace('-developer', ''); // e.g., "webapp"
      permissions.push({ app, env: 'NP', access: 'write' });
      permissions.push({ app, env: 'PP', access: 'write' });
    } 
    else if (group.endsWith('-prod-viewer')) {
      // Prod viewer: read-only to Prod
      const app = group.replace('-prod-viewer', ''); // e.g., "webapp"
      permissions.push({ app, env: 'Prod', access: 'read' });
    }
  }

  return permissions;
}
```

---

## Example Scenarios

### Scenario 1: webapp Developer

**User**: `alice@company.com`  
**Groups**: `webapp-developer`

**Permissions**:
```json
[
  { "app": "webapp", "env": "NP", "access": "write" },
  { "app": "webapp", "env": "PP", "access": "write" }
]
```

**What Alice Can Do**:
- ✅ View webapp secrets in NP and PP
- ✅ Create new webapp secrets in NP and PP
- ✅ Update webapp secrets in NP and PP
- ✅ See "webapp" in application dropdown
- ❌ Cannot see Prod secrets
- ❌ Cannot see other applications (MFT, FFIN, etc.)

### Scenario 2: webapp Developer + Prod Viewer

**User**: `bob@company.com`  
**Groups**: `webapp-developer`, `webapp-prod-viewer`

**Permissions**:
```json
[
  { "app": "webapp", "env": "NP", "access": "write" },
  { "app": "webapp", "env": "PP", "access": "write" },
  { "app": "webapp", "env": "Prod", "access": "read" }
]
```

**What Bob Can Do**:
- ✅ View webapp secrets in NP, PP, and Prod
- ✅ Create/update webapp secrets in NP and PP
- ✅ View webapp Prod secrets (read-only)
- ❌ Cannot update Prod secrets
- ❌ Cannot see other applications

### Scenario 3: Multi-Application Access

**User**: `charlie@company.com`  
**Groups**: `webapp-developer`, `mft-prod-viewer`

**Permissions**:
```json
[
  { "app": "webapp", "env": "NP", "access": "write" },
  { "app": "webapp", "env": "PP", "access": "write" },
  { "app": "mft", "env": "Prod", "access": "read" }
]
```

**What Charlie Can Do**:
- ✅ View/edit webapp secrets in NP and PP
- ✅ View MFT Prod secrets (read-only)
- ✅ See both "webapp" and "MFT" in application dropdown
- ❌ Cannot edit MFT secrets
- ❌ Cannot see other applications

### Scenario 4: Admin

**User**: `admin@company.com`  
**Groups**: `secrets-admin`

**Permissions**:
```json
[
  { "app": "*", "env": "*", "access": "write" }
]
```

**What Admin Can Do**:
- ✅ View/edit ALL secrets in ALL applications and environments
- ✅ See ALL applications in dropdown
- ✅ Access admin reports (Access Report, Console Changes)
- ✅ Full control over everything

---

## How to Add a New Application

### Option 1: Automatic (Recommended)

Just create a secret with the new application name - it will automatically appear in the dropdown!

1. Admin creates a secret with `application: "newapp"`
2. Create Cognito groups: `newapp-developer`, `newapp-prod-viewer`
3. Add users to the groups
4. Users will see "newapp" in their dropdown automatically

### Option 2: Pre-create Groups

```bash
# Create groups before any secrets exist
aws cognito-idp create-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --group-name newapp-developer \
  --description "Read/write access to newapp secrets in NP and PP"

aws cognito-idp create-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --group-name newapp-prod-viewer \
  --description "Read-only access to newapp secrets in Prod"
```

---

## Testing Access

### Test as webapp User

1. **Create test user**:
```bash
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username webapp-user@test.com \
  --user-attributes Name=email,Value=webapp-user@test.com \
  --temporary-password "TempPass123!"
```

2. **Add to webapp-developer group**:
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username webapp-user@test.com \
  --group-name webapp-developer
```

3. **Login and verify**:
   - Login with webapp-user@test.com
   - Should only see "webapp" in application dropdown
   - Should only see webapp secrets
   - Should be able to create webapp secrets in NP/PP
   - Should NOT see other applications

---

## Security Features

### 1. Permission Filtering
- **Backend filters all data** based on user permissions
- Users cannot bypass by manipulating frontend
- API returns 403 Forbidden for unauthorized access

### 2. Token Validation
- JWT tokens are validated on every request
- Expired tokens are rejected
- Invalid tokens return 401 Unauthorized

### 3. Least Privilege
- Users only get access they need
- Developers cannot access Prod (unless explicitly granted)
- Read-only users cannot modify secrets

### 4. Audit Trail
- All actions are logged with user email
- Audit logs track who accessed/modified what
- Prod changes trigger notifications

---

## Common Tasks

### Give User Access to Multiple Applications

```bash
# User needs access to both webapp and api applications
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com \
  --group-name webapp-developer

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com \
  --group-name api-developer
```

### Promote User to Admin

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin@company.com \
  --group-name secrets-admin
```

### Remove User Access

```bash
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com \
  --group-name webapp-developer
```

### List User's Groups

```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com
```

---

## Troubleshooting

### User Can't See Any Secrets

**Cause**: User not in any groups  
**Solution**: Add user to appropriate group

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com \
  --group-name webapp-developer
```

### User Sees Wrong Applications

**Cause**: User in wrong groups  
**Solution**: Check user's groups and remove/add as needed

```bash
# List current groups
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com

# Remove from wrong group
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com \
  --group-name wrong-group
```

### User Can't Update Secrets

**Cause**: User in prod-viewer group (read-only)  
**Solution**: Add to developer group for write access

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@company.com \
  --group-name webapp-developer
```

---

## Summary

✅ **Group-based access control** - Simple and scalable  
✅ **Application isolation** - Users only see their apps  
✅ **Environment separation** - Developers can't touch Prod  
✅ **Dynamic dropdowns** - Only show what user can access  
✅ **No code changes needed** - Just manage Cognito groups  
✅ **Audit trail** - Track all access and changes  

**To give webapp users access to only webapp secrets:**
1. Create `webapp-developer` and `webapp-prod-viewer` groups
2. Add users to appropriate groups
3. Users automatically see only webapp secrets
4. No code deployment needed!
