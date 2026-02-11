# Secrets Management Portal - Architecture Documentation

## Overview

The Secrets Management Portal is a secure web application for managing AWS Secrets Manager secrets with role-based access control, audit logging, and rotation tracking.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React Frontend (Static Files served by Nginx)             │ │
│  │  - No direct AWS access                                    │ │
│  │  - Only communicates with Express API                      │ │
│  │  - Stores JWT token in memory (not localStorage)           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (JWT Token in Header)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EC2 Instance (Nginx)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Nginx Reverse Proxy                                       │ │
│  │  - Serves React static files                              │ │
│  │  - Proxies /api/* to Express backend                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Express.js Backend (Node.js/PM2)                         │ │
│  │  - Validates JWT tokens with Cognito                      │ │
│  │  - Enforces role-based access control                     │ │
│  │  - Interacts with AWS services                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ AWS SDK
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Cognito    │  │  DynamoDB    │  │   Secrets    │          │
│  │  User Pool   │  │              │  │   Manager    │          │
│  │              │  │  - Metadata  │  │              │          │
│  │  - Auth      │  │  - Audit Log │  │  - Secret    │          │
│  │  - Groups    │  │              │  │    Values    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │     SNS      │  │   Lambda     │                            │
│  │              │  │              │                            │
│  │  - Email     │  │  - Rotation  │                            │
│  │    Alerts    │  │    Checker   │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

### 1. Authentication Flow

```
User Login
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. User enters credentials in React UI  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. React calls Cognito directly         │
│    (AWS Amplify SDK)                    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. Cognito validates credentials        │
│    Returns JWT tokens (ID, Access)      │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. React stores JWT in memory           │
│    (AuthContext - NOT localStorage)     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. All API calls include JWT in header  │
│    Authorization: Bearer <token>        │
└─────────────────────────────────────────┘
```

### 2. API Request Flow

```
React Component
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. User clicks "View Secret"            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. apiClient.getSecret(id)              │
│    Adds JWT token to request header     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. Express receives request             │
│    GET /api/secrets/:id                 │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. Auth Middleware validates JWT        │
│    - Verifies signature with Cognito    │
│    - Extracts user info (email, groups) │
│    - Builds permissions from groups     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. Controller checks permissions        │
│    - Reads metadata from DynamoDB       │
│    - Verifies user can access this app  │
│    - Checks read/write permissions      │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 6. If authorized, fetch from AWS        │
│    - Get secret metadata from DynamoDB  │
│    - Get secret value from Secrets Mgr  │
│    - Create audit log entry             │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 7. Return data to React                 │
│    (Secret values are NEVER stored)     │
└─────────────────────────────────────────┘
```

## Key Security Principles

### Frontend Security

1. **No Direct AWS Access**
   - React app has NO AWS credentials
   - Cannot access DynamoDB, Secrets Manager, or any AWS service directly
   - All AWS operations go through the Express backend

2. **JWT Token Handling**
   - Tokens stored in React Context (memory only)
   - NOT stored in localStorage or sessionStorage
   - Tokens expire after 1 hour
   - Automatically cleared on logout

3. **No Secret Values in Frontend**
   - Secret values are NEVER stored in React state
   - Only displayed temporarily when user requests
   - Cleared immediately after viewing

### Backend Security

1. **JWT Validation**
   ```typescript
   // Every API request validates the JWT
   const payload = await verifier.verify(token);
   
   // Extract user information
   const userId = payload.sub;
   const email = payload.email;
   const groups = payload['cognito:groups'];
   ```

2. **Role-Based Access Control (RBAC)**
   ```typescript
   // Groups determine permissions
   secrets-admin        → Full access to all secrets
   app1-developer       → Read/Write to app1 NP/PP
   app1-prod-viewer     → Read-only to app1 Prod
   ```

3. **Permission Enforcement**
   ```typescript
   // Before any operation, check permissions
   requireReadPermission(user, application, environment);
   requireWritePermission(user, application, environment);
   ```

## Data Flow Examples

### Example 1: Viewing a Secret

```
User Action: Click on secret "database-password"
    │
    ▼
React: apiClient.getSecret("abc123")
    │
    ▼
Express: GET /api/secrets/abc123
    │
    ├─> Auth Middleware
    │   ├─> Verify JWT with Cognito ✓
    │   ├─> Extract: email="admin@example.com", groups=["secrets-admin"]
    │   └─> Build permissions: [{app: "*", env: "*", access: "write"}]
    │
    ├─> Controller
    │   ├─> Get metadata from DynamoDB
    │   │   └─> {secretId: "abc123", application: "app1", environment: "Prod"}
    │   │
    │   ├─> Check permission
    │   │   └─> User has "*" access ✓
    │   │
    │   ├─> Get secret from AWS Secrets Manager
    │   │   └─> {value: "actual-password-here"}
    │   │
    │   └─> Create audit log
    │       └─> {userId: "admin@example.com", action: "READ", timestamp: "..."}
    │
    └─> Return to React
        └─> Display secret details (without value)
```

### Example 2: Updating a Secret (Prod)

```
User Action: Update secret value in Prod
    │
    ▼
React: apiClient.updateSecret("abc123", {value: "new-password"})
    │
    ▼
Express: PUT /api/secrets/abc123
    │
    ├─> Auth Middleware
    │   ├─> Verify JWT ✓
    │   └─> Extract: email="app1-viewer", groups=["app1-prod-viewer"]
    │
    ├─> Controller
    │   ├─> Get metadata: {application: "app1", environment: "Prod"}
    │   │
    │   ├─> Check permission
    │   │   └─> User has "read" access to app1 Prod
    │   │   └─> Needs "write" access ✗
    │   │
    │   └─> Return 403 Forbidden
    │
    └─> React shows error: "You don't have permission"
```

### Example 3: Rotation Reminder (Lambda)

```
CloudWatch Event: Daily at 9 AM
    │
    ▼
Lambda: rotation-checker
    │
    ├─> Scan all secrets from DynamoDB
    │   └─> Find secrets where (rotationPeriod - daysSinceRotation) <= 7
    │
    ├─> Group by application and environment
    │
    ├─> Send SNS notification
    │   └─> Email: "app1 Prod secrets need rotation in 5 days"
    │
    └─> Update DynamoDB
        └─> Set notificationSent = true
```

## Data Storage

### DynamoDB Tables

#### 1. secrets-metadata
```
Primary Key: secretId (String)

Attributes:
- secretId: Unique identifier
- secretName: Human-readable name
- application: App name (app1, app2, etc.)
- environment: NP, PP, or Prod
- secretArn: AWS Secrets Manager ARN
- rotationPeriod: 45, 60, or 90 days
- lastModified: ISO timestamp
- lastRotated: ISO timestamp (for compatibility)
- createdBy: User email
- lastModifiedBy: User email
- notificationSent: Boolean
- tags: Map of key-value pairs
```

#### 2. secrets-audit-log
```
Primary Key: secretId (String)
Sort Key: timestamp (String)

Attributes:
- secretId: Secret identifier
- timestamp: ISO timestamp
- userId: User email (or Cognito ID for old entries)
- action: READ, CREATE, UPDATE, DELETE, CONSOLE_ACCESS
- ipAddress: Request IP
- userAgent: Browser info
- success: Boolean
- errorMessage: Optional error details
- details: Optional action details (e.g., "Rotation period changed from 45 to 60 days")
- ttl: Expiration timestamp (90 days)
```

### AWS Secrets Manager

```
Secret Structure:
{
  "value": "actual-secret-value",
  "metadata": {
    "description": "Database password",
    "owner": "admin@example.com"
  }
}

Tags:
- Application: app1
- Environment: Prod
- ManagedBy: SecretsPortal
- RotationPeriod: 60
```

## API Endpoints

### Authentication
- All endpoints require `Authorization: Bearer <JWT>` header
- JWT must be valid and not expired
- User must have appropriate permissions

### Secrets Management

```
GET /api/secrets
- List all secrets user has access to
- Query params: application, environment, limit
- Returns: Array of secret metadata (no values)

GET /api/secrets/search?q=<query>
- Search secrets by name, application, or environment
- Returns: Filtered array of secrets

GET /api/secrets/:id
- Get detailed secret metadata
- Requires: Read permission
- Returns: Secret details with tags (no value)

POST /api/secrets
- Create new secret
- Requires: Write permission for app/env
- Body: {name, application, environment, rotationPeriod, value}
- Creates: Secret in AWS + metadata in DynamoDB + audit log

PUT /api/secrets/:id
- Update secret value
- Requires: Write permission
- Body: {value}
- Updates: Secret in AWS + metadata timestamp + audit log
- Sends: Email notification if Prod environment

PUT /api/secrets/:id/rotation
- Update rotation period
- Requires: Write permission
- Body: {rotationPeriod: 45|60|90}
- Updates: Metadata in DynamoDB + audit log
- Sends: Email notification if Prod environment

GET /api/secrets/:id/console-url
- Get AWS Console URL for secret
- Requires: Read permission
- Returns: Direct link to secret in AWS Console
- Creates: Audit log entry

GET /api/secrets/:id/audit
- Get audit log for secret
- Requires: Read permission
- Returns: Array of audit log entries
```

## Permission Model

### User Groups → Permissions

```typescript
// Admin Group
"secrets-admin" → {
  app: "*",
  env: "*",
  access: "write"
}

// Developer Group
"app1-developer" → [
  {app: "app1", env: "NP", access: "write"},
  {app: "app1", env: "PP", access: "write"}
]

// Prod Viewer Group
"app1-prod-viewer" → {
  app: "app1",
  env: "Prod",
  access: "read"
}
```

### Permission Checks

```typescript
// Read Permission
function requireReadPermission(user, app, env) {
  const hasPermission = user.permissions.some(p => 
    (p.app === "*" || p.app === app) &&
    (p.env === "*" || p.env === env) &&
    (p.access === "read" || p.access === "write")
  );
  
  if (!hasPermission) {
    throw new ApiError(403, 'FORBIDDEN', 'Insufficient permissions');
  }
}

// Write Permission
function requireWritePermission(user, app, env) {
  const hasPermission = user.permissions.some(p => 
    (p.app === "*" || p.app === app) &&
    (p.env === "*" || p.env === env) &&
    p.access === "write"
  );
  
  if (!hasPermission) {
    throw new ApiError(403, 'FORBIDDEN', 'Insufficient permissions');
  }
}
```

## Notification System

### Immediate Notifications (Prod Changes)

```typescript
// Triggered on:
// 1. Secret value update in Prod
// 2. Rotation period change in Prod

if (metadata.environment === 'Prod') {
  await sendProdSecretChangeNotification(
    secretName,
    application,
    action, // 'UPDATE' or 'ROTATION_CHANGE'
    details,
    userEmail
  );
}

// Email format:
Subject: [PROD] Secret Value Updated - database-password
Body:
  Production Secret Change Alert
  
  Action: Secret Value Updated
  Secret: database-password
  Application: app1
  Environment: Prod
  Details: Secret value updated
  Modified By: admin@example.com
  Timestamp: 2026-01-23T01:30:00Z
```

### Scheduled Notifications (Rotation Reminders)

```typescript
// Lambda runs daily
// Checks all secrets where:
//   (rotationPeriod - daysSinceRotation) <= 7

// Email format:
Subject: Secret Rotation Reminder - 3 secret(s) require attention
Body:
  Secret Rotation Reminder
  
  The following secrets require attention for rotation:
  
  === app1 - Prod ===
  
  - Secret: database-password
    Days Since Rotation: 55
    Rotation Period: 60 days
    Status: Due in 5 days
  
  - Secret: api-key
    Days Since Rotation: 62
    Rotation Period: 60 days
    Status: OVERDUE by 2 days
```

## Deployment Architecture

### EC2 Instance Setup

```
/home/ubuntu/packages/backend-express/
├── dist/                    # Compiled TypeScript
├── node_modules/
├── package.json
└── .env                     # Environment variables

/var/www/secrets-portal/
├── index.html              # React entry point
└── assets/
    └── index-[hash].js     # React bundle

/etc/nginx/sites-available/secrets-portal
- Serves React static files
- Proxies /api/* to Express (port 3000)

PM2 Process Manager
- Runs Express backend
- Auto-restart on failure
- Log management
```

### Environment Variables

```bash
# Backend Express (.env)
PORT=3000
NODE_ENV=production
AWS_REGION=us-east-1
USER_POOL_ID=us-east-1_XXXXXXXXX
CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
SECRETS_METADATA_TABLE=secrets-metadata
AUDIT_LOG_TABLE=secrets-audit-log
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:XXXX:secrets-notifications
```

## Monitoring & Logging

### Application Logs

```bash
# Backend logs
pm2 logs secrets-api

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Audit Trail

Every action is logged in DynamoDB:
- Who performed the action (email)
- What action was performed
- When it happened (timestamp)
- Which secret was affected
- Success/failure status
- Additional details (e.g., what changed)

### CloudWatch (Lambda)

- Rotation checker execution logs
- SNS notification delivery status
- DynamoDB operation metrics

## Best Practices

### For Developers

1. **Never log secret values**
   - Only log metadata (secret IDs, names)
   - Audit logs never contain actual secret values

2. **Always validate permissions**
   - Check permissions before any AWS operation
   - Use `requireReadPermission` and `requireWritePermission`

3. **Handle errors gracefully**
   - Return appropriate HTTP status codes
   - Provide clear error messages
   - Log errors for debugging

### For Users

1. **Rotate secrets regularly**
   - Follow the configured rotation period
   - Respond to rotation reminders promptly

2. **Use appropriate permissions**
   - Developers: NP/PP access only
   - Prod viewers: Read-only Prod access
   - Admins: Full access (use carefully)

3. **Review audit logs**
   - Check who accessed secrets
   - Verify no unauthorized access
   - Investigate suspicious activity

## Troubleshooting

### Common Issues

1. **403 Forbidden**
   - User doesn't have permission for this app/environment
   - Check Cognito groups
   - Verify permission mapping

2. **401 Unauthorized**
   - JWT token expired (1 hour)
   - User needs to log in again
   - Check Cognito configuration

3. **Secret not found**
   - Secret exists in AWS but not in DynamoDB
   - Or vice versa
   - Check both systems for consistency

4. **Audit logs showing Cognito IDs**
   - Old entries from before the fix
   - New entries will show emails
   - Historical data cannot be changed

## Future Enhancements

1. **Secret Rotation Automation**
   - Automatic rotation for supported secret types
   - Integration with AWS Secrets Manager rotation

2. **Advanced Search**
   - Full-text search in DynamoDB
   - Filter by tags, rotation status, etc.

3. **Bulk Operations**
   - Update multiple secrets at once
   - Bulk rotation period changes

4. **Enhanced Notifications**
   - Slack integration
   - Custom notification rules
   - Escalation policies

5. **Compliance Reports**
   - Generate compliance reports
   - Export audit logs
   - Rotation compliance dashboard
