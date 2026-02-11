# Secrets Management Portal - Design Document

## Overview

The Secrets Management Portal is a web-based application that provides a user-friendly interface for managing AWS Secrets Manager secrets across 6 applications and 3 environments (NP, PP, Prod). The system includes automated rotation monitoring with configurable notification periods and a search interface for easy secret discovery.

### Key Features

- Centralized secret management for 6 applications × 3 environments
- Automated rotation tracking with notifications (45/60/90 day periods)
- Search and filter capabilities
- Role-based access control
- Audit logging for compliance

## Architecture

### High-Level Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Browser   │────────▶│   Web Frontend   │────────▶│   API Gateway   │
│   (React)   │         │   (React SPA)    │         │                 │
└─────────────┘         └──────────────────┘         └────────┬────────┘
                                                               │
                        ┌──────────────────────────────────────┼────────────────┐
                        │                                      │                │
                        ▼                                      ▼                ▼
              ┌──────────────────┐              ┌──────────────────┐  ┌─────────────┐
              │  Lambda: Secrets │              │ Lambda: Rotation │  │  Lambda:    │
              │  CRUD Operations │              │    Checker       │  │  Auth       │
              └────────┬─────────┘              └────────┬─────────┘  └──────┬──────┘
                       │                                 │                   │
                       ▼                                 ▼                   ▼
              ┌─────────────────┐              ┌──────────────────┐  ┌─────────────┐
              │  AWS Secrets    │              │   DynamoDB:      │  │   Cognito   │
              │    Manager      │              │   Metadata       │  │             │
              └─────────────────┘              └──────────────────┘  └─────────────┘
                                                         │
                                                         ▼
                                               ┌──────────────────┐
                                               │  EventBridge     │
                                               │  (Daily Trigger) │
                                               └────────┬─────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │      SNS         │
                                               │  (Notifications) │
                                               └──────────────────┘
```

### Technology Stack

- **Frontend**: React with TypeScript, Material-UI for components
- **API Layer**: AWS API Gateway (REST API)
- **Compute**: AWS Lambda (Node.js 20.x runtime)
- **Secret Storage**: AWS Secrets Manager
- **Metadata Storage**: DynamoDB
- **Authentication**: AWS Cognito
- **Notifications**: Amazon SNS + Amazon SES for email
- **Scheduling**: Amazon EventBridge (CloudWatch Events)
- **Infrastructure**: AWS CDK or Terraform for IaC

## Components and Interfaces

### 1. Frontend Application (React SPA)

**Purpose**: Provides the user interface for secret management

**Key Components**:
- `SecretsList`: Displays paginated list of secrets with search/filter, showing tags from AWS
- `SecretDetail`: Shows secret metadata with AWS console URL link
- `SecretEditor`: Form for creating/updating secrets
- `SearchBar`: Real-time search with autocomplete
- `NotificationSettings`: Configure rotation periods per secret
- `AuditLog`: View access history

**API Integration**:
```typescript
interface SecretsAPI {
  listSecrets(filters?: SearchFilters): Promise<Secret[]>
  getSecret(secretId: string): Promise<SecretDetail>
  getConsoleUrl(secretId: string): Promise<string>
  createSecret(secret: CreateSecretRequest): Promise<Secret>
  updateSecret(secretId: string, value: string): Promise<void>
  updateRotationPeriod(secretId: string, days: number): Promise<void>
}

interface Secret {
  id: string
  name: string
  application: string          // From AWS tag
  environment: 'NP' | 'PP' | 'Prod'  // From AWS tag
  rotationPeriod: 45 | 60 | 90
  lastModified: string
  daysSinceRotation: number
  awsRegion: string
  tags: Record<string, string>  // All tags from AWS Secrets Manager
}
```

### 2. API Gateway

**Purpose**: Provides RESTful API endpoints with authentication and authorization

**Endpoints**:
```
GET    /secrets                    - List secrets (with query params for filtering)
GET    /secrets/{id}               - Get secret metadata with tags
GET    /secrets/{id}/console-url   - Get AWS console URL for secret
POST   /secrets                    - Create new secret
PUT    /secrets/{id}               - Update secret value
PUT    /secrets/{id}/rotation      - Update rotation period
GET    /secrets/search?q={query}   - Search secrets
GET    /audit/{secretId}           - Get audit log for secret
```

**Authentication**: AWS Cognito JWT tokens in Authorization header

**Authorization**: Custom Lambda authorizer validates user permissions based on Cognito groups

### 3. Secrets CRUD Lambda

**Purpose**: Handles all secret operations with AWS Secrets Manager

**Key Functions**:
```typescript
// List secrets with filtering
async function listSecrets(userId: string, filters: Filters): Promise<Secret[]> {
  // 1. Get user permissions from Cognito groups
  // 2. Query DynamoDB for secret metadata
  // 3. Filter based on user permissions
  // 4. Return paginated results
}

// Get secret metadata with tags
async function getSecretMetadata(secretId: string, userId: string): Promise<SecretDetail> {
  // 1. Verify user has read permission
  // 2. Call AWS Secrets Manager DescribeSecret to get tags
  // 3. Fetch additional metadata from DynamoDB
  // 4. Calculate days since rotation
  // 5. Return metadata with all tags
}

// Get AWS console URL
async function getConsoleUrl(secretId: string, userId: string): Promise<string> {
  // 1. Verify user has read permission
  // 2. Get secret ARN and region
  // 3. Generate AWS console URL:
  //    https://console.aws.amazon.com/secretsmanager/secret?name={secretName}&region={region}
  // 4. Log access event to DynamoDB audit table
  // 5. Return console URL
}

// Create secret
async function createSecret(request: CreateSecretRequest, userId: string): Promise<Secret> {
  // 1. Verify user has write permission
  // 2. Generate secret name: {app}-{env}-{name}
  // 3. Create in AWS Secrets Manager with tags:
  //    - Application: {app}
  //    - Environment: {env}
  //    - ManagedBy: SecretsPortal
  //    - RotationPeriod: {period}
  // 4. Store metadata in DynamoDB
  // 5. Return created secret with tags
}

// Update secret
async function updateSecret(secretId: string, newValue: string, userId: string): Promise<void> {
  // 1. Verify user has write permission
  // 2. Update in AWS Secrets Manager
  // 3. Update lastModified in DynamoDB
  // 4. Reset rotation notification flag
  // 5. Log update event
}
```

**IAM Permissions Required**:
- `secretsmanager:DescribeSecret`
- `secretsmanager:CreateSecret`
- `secretsmanager:UpdateSecret`
- `secretsmanager:ListSecrets`
- `secretsmanager:TagResource`
- `secretsmanager:GetResourcePolicy`

### 4. Rotation Checker Lambda

**Purpose**: Monitors secret age and sends notifications

**Trigger**: EventBridge rule (daily at 09:00 UTC)

**Logic**:
```typescript
async function checkRotations(): Promise<void> {
  // 1. Query DynamoDB for all secrets
  // 2. For each secret:
  //    a. Calculate days since lastModified
  //    b. Compare against rotationPeriod (45/60/90)
  //    c. Check if notification already sent for this period
  //    d. If overdue and not notified:
  //       - Publish to SNS topic
  //       - Update notification flag in DynamoDB
  // 3. Generate summary report
}
```

**SNS Message Format**:
```json
{
  "subject": "Secret Rotation Required",
  "secrets": [
    {
      "name": "app1-prod-db-password",
      "application": "app1",
      "environment": "Prod",
      "daysSinceRotation": 92,
      "rotationPeriod": 90
    }
  ]
}
```

### 5. Authentication Lambda

**Purpose**: Custom authorizer for API Gateway

**Logic**:
```typescript
async function authorize(token: string, resource: string): Promise<AuthPolicy> {
  // 1. Verify JWT token with Cognito
  // 2. Extract user groups from token
  // 3. Map groups to permissions:
  //    - secrets-admin: full access to all secrets
  //    - app1-developer: read/write app1 NP/PP secrets only
  //    - app1-prod-viewer: read-only app1 Prod secrets only
  //    - app2-developer: read/write app2 NP/PP secrets only
  //    - app2-prod-viewer: read-only app2 Prod secrets only
  //    ... (repeat for app3-6)
  // 4. Parse resource ARN to extract application and environment
  // 5. Check if user's permissions allow access to this resource
  // 6. Generate IAM policy for API Gateway
  // 7. Return allow/deny decision with user context
}
```

**Example Authorization Flow**:
- User "john@company.com" is in groups: `app1-developer`, `app3-prod-viewer`
- John requests: GET /secrets?application=app1&environment=NP
- Authorizer checks: app1-developer group allows app1 + NP → ALLOW
- John requests: GET /secrets?application=app2&environment=NP  
- Authorizer checks: No group allows app2 access → DENY
- John requests: GET /secrets?application=app3&environment=Prod
- Authorizer checks: app3-prod-viewer group allows app3 + Prod (read-only) → ALLOW

## Data Models

### DynamoDB Tables

#### Secrets Metadata Table

**Table Name**: `secrets-metadata`

**Primary Key**: `secretId` (String, partition key)

**Attributes**:
```typescript
interface SecretMetadata {
  secretId: string              // PK: UUID
  secretArn: string             // AWS ARN
  secretName: string            // app-env-name format
  application: string           // GSI partition key (from AWS tag)
  environment: 'NP' | 'PP' | 'Prod'  // From AWS tag
  awsRegion: string             // AWS region
  rotationPeriod: 45 | 60 | 90  // From AWS tag
  createdAt: string             // ISO 8601
  lastModified: string          // ISO 8601
  createdBy: string             // User ID
  lastModifiedBy: string        // User ID
  notificationSent: boolean
  lastNotificationDate?: string
  tags: Record<string, string>  // All tags from AWS Secrets Manager
}
```

**Global Secondary Indexes**:
- `application-index`: Partition key = `application`, Sort key = `environment`
- `environment-index`: Partition key = `environment`

#### Audit Log Table

**Table Name**: `secrets-audit-log`

**Primary Key**: 
- Partition key: `secretId` (String)
- Sort key: `timestamp` (String, ISO 8601)

**Attributes**:
```typescript
interface AuditLogEntry {
  secretId: string
  timestamp: string
  userId: string
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'CONSOLE_ACCESS'
  ipAddress: string
  userAgent: string
  success: boolean
  errorMessage?: string
}
```

**TTL**: 90 days (configurable)

### AWS Secrets Manager Secret Structure

**Naming Convention**: `{application}-{environment}-{secret-name}`

Examples:
- `app1-np-database-password`
- `app2-prod-api-key`

**Tags**:
```json
{
  "Application": "app1",
  "Environment": "Prod",
  "ManagedBy": "SecretsPortal",
  "RotationPeriod": "90"
}
```

Note: The Portal will read Application and Environment tags from existing secrets to display them in the UI. When creating new secrets, these tags will be automatically added.

**Secret Value Format**:
```json
{
  "value": "actual-secret-value",
  "metadata": {
    "description": "Database password for App1 production",
    "owner": "team-app1@company.com"
  }
}
```

## Error Handling

### Frontend Error Handling

1. **Network Errors**: Display toast notification with retry option
2. **Authentication Errors**: Redirect to login page
3. **Authorization Errors**: Display "Access Denied" message with contact info
4. **Validation Errors**: Inline form validation with clear error messages

### Backend Error Handling

1. **AWS API Errors**:
   - Implement exponential backoff retry (3 attempts)
   - Log errors to CloudWatch
   - Return user-friendly error messages

2. **Lambda Error Responses**:
```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
}

// Error codes:
// - AUTH_FAILED: Authentication failure
// - FORBIDDEN: Authorization failure
// - NOT_FOUND: Secret not found
// - VALIDATION_ERROR: Invalid input
// - AWS_ERROR: AWS service error
// - INTERNAL_ERROR: Unexpected error
```

3. **DynamoDB Errors**:
   - Handle throttling with exponential backoff
   - Implement conditional writes to prevent race conditions
   - Use transactions for multi-item operations

4. **Secrets Manager Errors**:
   - `ResourceNotFoundException`: Return 404 to client
   - `InvalidRequestException`: Return 400 with validation details
   - `ThrottlingException`: Retry with backoff
   - `InternalServiceError`: Return 503 with retry-after header

## Security Considerations

### Access Control

1. **Cognito User Groups** (per application):
   
   For each of the 6 applications, create the following groups:
   - `secrets-admin`: Full access to all secrets across all applications and environments
   - `app1-developer`: Read/write access to app1 secrets in NP and PP environments only
   - `app1-prod-viewer`: Read-only access to app1 secrets in Prod environment
   - `app2-developer`: Read/write access to app2 secrets in NP and PP environments only
   - `app2-prod-viewer`: Read-only access to app2 secrets in Prod environment
   - ... (repeat for app3, app4, app5, app6)

2. **Group-Based Filtering**:
   - Users only see secrets they have permission to access based on their group membership
   - A user in `app1-developer` group will ONLY see app1 secrets in NP and PP environments
   - A user in `app1-prod-viewer` group will ONLY see app1 secrets in Prod environment (read-only)
   - A user can be in multiple groups (e.g., `app1-developer` + `app2-prod-viewer`)

3. **Permission Matrix**:
   ```
   Group                  | NP Secrets | PP Secrets | Prod Secrets | Actions
   -----------------------|------------|------------|--------------|------------------
   secrets-admin          | All Apps   | All Apps   | All Apps     | Read, Write, Update
   app1-developer         | App1 only  | App1 only  | No access    | Read, Write, Update
   app1-prod-viewer       | No access  | No access  | App1 only    | Read only
   app2-developer         | App2 only  | App2 only  | No access    | Read, Write, Update
   app2-prod-viewer       | No access  | No access  | App2 only    | Read only
   ... (repeat for app3-6)
   ```

4. **Implementation in Lambda Authorizer**:
   ```typescript
   function getUserPermissions(cognitoGroups: string[]): Permission[] {
     const permissions: Permission[] = []
     
     for (const group of cognitoGroups) {
       if (group === 'secrets-admin') {
         permissions.push({ app: '*', env: '*', access: 'write' })
       } else if (group.endsWith('-developer')) {
         const app = group.replace('-developer', '')
         permissions.push({ app, env: 'NP', access: 'write' })
         permissions.push({ app, env: 'PP', access: 'write' })
       } else if (group.endsWith('-prod-viewer')) {
         const app = group.replace('-prod-viewer', '')
         permissions.push({ app, env: 'Prod', access: 'read' })
       }
     }
     
     return permissions
   }
   ```

5. **Least Privilege**: Lambda execution roles have minimal required permissions

6. **Secret Value Access**: Users click "Open in AWS Console" button to access secrets directly in AWS, all console URL requests are logged

2. **Data Protection**

1. **Encryption in Transit**: TLS 1.2+ for all API calls
2. **Encryption at Rest**: AWS Secrets Manager default encryption (KMS)
3. **No Secret Values in Portal**: Portal never retrieves or displays actual secret values, only metadata and console URLs
4. **Session Management**: 8-hour timeout with secure cookie flags

### Audit and Compliance

1. **CloudWatch Logs**: All Lambda invocations logged
2. **Audit Table**: All secret access events recorded
3. **CloudTrail**: AWS API calls tracked
4. **Notification History**: All rotation alerts logged

## Testing Strategy

### Unit Tests

1. **Frontend Components**:
   - Test rendering with mock data
   - Test user interactions (search, reveal, update)
   - Test error state handling

2. **Lambda Functions**:
   - Test business logic with mocked AWS SDK calls
   - Test permission validation
   - Test error handling paths

### Integration Tests

1. **API Tests**:
   - Test end-to-end API flows with test secrets
   - Test authentication and authorization
   - Test error responses

2. **AWS Integration**:
   - Test Secrets Manager operations in test environment
   - Test DynamoDB queries and updates
   - Test SNS notification delivery

### End-to-End Tests

1. **User Workflows**:
   - Create secret → Search → View → Update → Verify notification
   - Test rotation checker with backdated secrets
   - Test access control with different user roles

2. **Performance Tests**:
   - Load test with 100+ concurrent users
   - Test search performance with 1000+ secrets
   - Verify API response times < 2 seconds

### Security Tests

1. **Authentication**: Test invalid tokens, expired tokens
2. **Authorization**: Test cross-application access attempts
3. **Input Validation**: Test SQL injection, XSS attempts
4. **Rate Limiting**: Test API throttling

## Deployment Strategy

### Infrastructure as Code

Use AWS CDK to define:
- Lambda functions with proper IAM roles
- API Gateway with Cognito authorizer
- DynamoDB tables with indexes
- EventBridge rules
- SNS topics and subscriptions
- Cognito user pool and groups

### Environments

1. **Development**: Single AWS account, test data
2. **Staging**: Separate account, production-like setup
3. **Production**: Separate account, multi-AZ deployment

### CI/CD Pipeline

1. **Build**: Compile TypeScript, run linters
2. **Test**: Run unit and integration tests
3. **Deploy to Dev**: Automatic on merge to main
4. **Deploy to Staging**: Manual approval
5. **Deploy to Prod**: Manual approval with change ticket

## Monitoring and Alerting

### CloudWatch Metrics

- API Gateway request count and latency
- Lambda invocation count, duration, errors
- DynamoDB read/write capacity usage
- Secrets Manager API call count

### Alarms

- Lambda error rate > 5%
- API Gateway 5xx errors > 10 in 5 minutes
- DynamoDB throttling events
- Rotation checker failures

### Dashboards

- Real-time API performance metrics
- Secret rotation status overview
- User activity heatmap
- Error rate trends
