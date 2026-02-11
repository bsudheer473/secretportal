# Test Users & Credentials

**User Pool ID**: `us-east-1_O9Yt0QiW0`  
**Login URL**: `http://44.220.58.117` (or your frontend URL)

---

## 🎯 Test Users for Your Requirements

### 1️⃣ User Who Can ONLY See webapp

**Email**: `app1-dev@example.com`  
**Password**: `Password123!` (or reset if needed)  
**Groups**: 
- `webapp-developer` ✅
- `app1-developer` (legacy - can ignore)

**Access**:
- ✅ Can see webapp secrets in NP & PP
- ✅ Can create/update webapp secrets in NP & PP
- ✅ Can see "webapp" and "app1" in application dropdown
- ❌ Cannot see api-service, windows, or other apps
- ❌ Cannot see Prod secrets

**Test This User**:
```bash
# Login with: app1-dev@example.com / Password123!
# Should see: webapp and app1 applications only
# Can create: webapp secrets in NP/PP
```

---

### 2️⃣ User Who Can ONLY See api-service

**Email**: `app2-dev@example.com`  
**Password**: `Password123!` (or reset if needed)  
**Groups**: 
- `api-service-developer` ✅
- `app2-developer` (legacy - can ignore)

**Access**:
- ✅ Can see api-service secrets in NP & PP
- ✅ Can create/update api-service secrets in NP & PP
- ✅ Can see "api-service" and "app2" in application dropdown
- ❌ Cannot see webapp, windows, or other apps
- ❌ Cannot see Prod secrets

**Test This User**:
```bash
# Login with: app2-dev@example.com / Password123!
# Should see: api-service and app2 applications only
# Can create: api-service secrets in NP/PP
```

---

### 3️⃣ User Who Can Update Prod Secrets

**Email**: `app3-dev@example.com`  
**Password**: `Password123!` (or reset if needed)  
**Groups**: 
- `webapp-developer` ✅ (read/write NP & PP)
- `webapp-prod-viewer` ✅ (read-only Prod)
- `app3-developer` (legacy - can ignore)

**Access**:
- ✅ Can see webapp secrets in NP, PP, and Prod
- ✅ Can create/update webapp secrets in NP & PP
- ✅ Can VIEW webapp Prod secrets (read-only)
- ⚠️ **Cannot UPDATE Prod** (only read access)
- ✅ Can see "webapp" and "app3" in application dropdown

**Note**: To give WRITE access to Prod, this user would need to be in `secrets-admin` group (full admin) since the current permission model doesn't support developer write access to Prod.

**Test This User**:
```bash
# Login with: app3-dev@example.com / Password123!
# Should see: webapp and app3 applications
# Can view: webapp Prod secrets (read-only)
# Can create/update: webapp NP/PP secrets
```

---

## 🔐 Admin User (Full Access)

**Email**: `admin@example.com`  
**Password**: `Password123!` (or reset if needed)  
**Groups**: `secrets-admin`

**Access**:
- ✅ Full access to ALL applications
- ✅ Full access to ALL environments (NP, PP, Prod)
- ✅ Can create/update/delete any secret
- ✅ Can access admin reports

---

## 🔄 Reset User Password

If you need to reset any user's password:

```bash
# Reset password for a user
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username app1-dev@example.com \
  --password "NewPassword123!" \
  --permanent
```

---

## 📝 Default Password

All test users were likely created with default password: **`Password123!`**

If that doesn't work, reset the password using the command above.

---

## ⚠️ Important: Prod Write Access

**Current Limitation**: The permission model has these access levels:

1. **Developer groups** (`{app}-developer`):
   - Read/Write to NP & PP
   - NO access to Prod

2. **Prod viewer groups** (`{app}-prod-viewer`):
   - Read-only to Prod
   - NO access to NP/PP

3. **Admin group** (`secrets-admin`):
   - Full read/write to ALL environments

**To give someone Prod WRITE access**, you have two options:

### Option A: Make them Admin (Full Access)
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username app3-dev@example.com \
  --group-name secrets-admin
```

### Option B: Create New Group Type (Requires Code Change)

You would need to:
1. Create new group pattern: `{app}-prod-developer`
2. Update `packages/backend-express/src/middleware/auth.ts`:

```typescript
else if (group.endsWith('-prod-developer')) {
  // Prod developer: read/write to Prod only
  const app = group.replace('-prod-developer', '');
  permissions.push({ app, env: 'Prod', access: 'write' });
}
```

3. Create the group:
```bash
aws cognito-idp create-group \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --group-name webapp-prod-developer \
  --description "Read/write access to webapp Prod secrets"
```

---

## 🧪 Testing Checklist

### Test User 1 (webapp only)
- [ ] Login with `app1-dev@example.com`
- [ ] Verify only sees "webapp" and "app1" in dropdown
- [ ] Can create webapp secret in NP
- [ ] Can update webapp secret in PP
- [ ] Cannot see api-service secrets
- [ ] Cannot see Prod environment

### Test User 2 (api-service only)
- [ ] Login with `app2-dev@example.com`
- [ ] Verify only sees "api-service" and "app2" in dropdown
- [ ] Can create api-service secret in NP
- [ ] Can update api-service secret in PP
- [ ] Cannot see webapp secrets
- [ ] Cannot see Prod environment

### Test User 3 (Prod viewer)
- [ ] Login with `app3-dev@example.com`
- [ ] Verify sees "webapp" and "app3" in dropdown
- [ ] Can view webapp Prod secrets
- [ ] Can create/update webapp NP/PP secrets
- [ ] Cannot update Prod secrets (read-only)

### Test Admin
- [ ] Login with `admin@example.com`
- [ ] Verify sees ALL applications
- [ ] Can access ALL environments
- [ ] Can create/update any secret
- [ ] Can access Reports section

---

## 📊 Quick Reference Table

| User | Email | Applications | Environments | Write Access |
|------|-------|--------------|--------------|--------------|
| User 1 | app1-dev@example.com | webapp, app1 | NP, PP | Yes (NP/PP) |
| User 2 | app2-dev@example.com | api-service, app2 | NP, PP | Yes (NP/PP) |
| User 3 | app3-dev@example.com | webapp, app3 | NP, PP, Prod | Yes (NP/PP), Read-only (Prod) |
| Admin | admin@example.com | ALL | ALL | Yes (ALL) |

---

## 🔧 Troubleshooting

### Can't Login
- Check password is correct: `Password123!`
- Reset password if needed (see command above)
- Verify user status is CONFIRMED

### User Sees Wrong Apps
- Check user's groups: 
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_O9Yt0QiW0 \
  --username app1-dev@example.com
```

### User Can't Create Secrets
- Verify user is in `-developer` group (not `-prod-viewer`)
- Check they're trying to create in NP or PP (not Prod)

---

## Summary

✅ **User 1** (webapp only): `app1-dev@example.com` / `Password123!`  
✅ **User 2** (api-service only): `app2-dev@example.com` / `Password123!`  
✅ **User 3** (Prod viewer): `app3-dev@example.com` / `Password123!`  
✅ **Admin** (full access): `admin@example.com` / `Password123!`

**Note**: User 3 can VIEW Prod but cannot UPDATE Prod. To give Prod write access, add them to `secrets-admin` group or implement the new `{app}-prod-developer` group pattern.
