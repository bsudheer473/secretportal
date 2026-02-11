# Testing Guide

This guide covers testing the deployed Secrets Management Portal infrastructure and authentication.

## Prerequisites

- Infrastructure deployed (see DEPLOYMENT.md)
- AWS CLI configured
- `jq` installed (optional, for JSON parsing)
- `curl` installed (for API testing)

## Quick Start

### 1. Set Up Test Users

Create test users and assign them to groups:

```bash
cd packages/infrastructure
./setup-cognito-users.sh dev
```

This creates the following test users:

| Username | Password | Groups | Access |
|----------|----------|--------|--------|
| admin | Admin123! | secrets-admin | Full access to all secrets |
| app1-dev | App1Dev123! | app1-developer | Read/write app1 NP/PP |
| app1-viewer | App1View123! | app1-prod-viewer | Read-only app1 Prod |
| app2-dev | App2Dev123! | app2-developer | Read/write app2 NP/PP |
| app2-viewer | App2View123! | app2-prod-viewer | Read-only app2 Prod |
| app3-dev | App3Dev123! | app3-developer | Read/write app3 NP/PP |
| app3-viewer | App3View123! | app3-prod-viewer | Read-only app3 Prod |
| multi-app | MultiApp123! | app1-developer, app2-developer, app3-prod-viewer | Multiple apps |

### 2. Test Authentication

Test that a user can authenticate and receive JWT tokens:

```bash
./test-authentication.sh dev admin Admin123!
```

This will:
- Authenticate the user with Cognito
- Retrieve JWT tokens (ID, Access, Refresh)
- Decode the ID token to show user information
- Display user groups
- Test an API call with the token

## Manual Testing

### Test User Authentication

```bash
ENVIRONMENT=dev
STACK_NAME="SecretsPortalStack-${ENVIRONMENT^}"

# Get Cognito configuration
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

# Authenticate
aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin,PASSWORD=Admin123!
```

### Test API Endpoints

Get an ID token from authentication, then test API endpoints:

```bash
# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

# Set your ID token
ID_TOKEN="your-id-token-here"

# List secrets
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets"

# Get secret metadata
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets/{secret-id}"

# Search secrets
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets/search?q=database"
```

### Test Authorization

Test that users can only access secrets they have permission for:

#### Test 1: Admin can access all secrets

```bash
# Authenticate as admin
AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin,PASSWORD=Admin123!)

ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken')

# Should succeed - admin has access to all
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets?application=app1&environment=Prod"
```

#### Test 2: App1 developer can access app1 NP/PP

```bash
# Authenticate as app1-dev
AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=app1-dev,PASSWORD=App1Dev123!)

ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken')

# Should succeed - app1-dev has access to app1 NP
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets?application=app1&environment=NP"

# Should fail - app1-dev does NOT have access to app1 Prod
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets?application=app1&environment=Prod"
```

#### Test 3: App1 viewer can only read app1 Prod

```bash
# Authenticate as app1-viewer
AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=app1-viewer,PASSWORD=App1View123!)

ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken')

# Should succeed - app1-viewer has read access to app1 Prod
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets?application=app1&environment=Prod"

# Should fail - app1-viewer does NOT have access to app1 NP
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets?application=app1&environment=NP"

# Should fail - app1-viewer cannot create secrets (read-only)
curl -X POST \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","application":"app1","environment":"Prod","value":"secret"}' \
  "${API_ENDPOINT}secrets"
```

### Test Lambda Functions

Verify Lambda functions are deployed and working:

```bash
cd packages/backend
./verify-deployment.sh dev
```

### Test Rotation Checker

Manually invoke the rotation checker Lambda:

```bash
# Get rotation checker function name
ROTATION_FUNCTION=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function' && contains(LogicalResourceId, 'Rotation')].PhysicalResourceId" \
  --output text)

# Invoke function
aws lambda invoke \
  --function-name "$ROTATION_FUNCTION" \
  --payload '{}' \
  response.json

# Check response
cat response.json
```

## End-to-End Testing

### Test Complete User Flow

1. **Create a test secret** (as admin):

```bash
# Authenticate as admin
AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin,PASSWORD=Admin123!)

ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken')

# Create secret
curl -X POST \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-database-password",
    "application": "app1",
    "environment": "NP",
    "rotationPeriod": 90,
    "value": "MySecretPassword123!"
  }' \
  "${API_ENDPOINT}secrets"
```

2. **List secrets** (as app1-dev):

```bash
# Authenticate as app1-dev
AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=app1-dev,PASSWORD=App1Dev123!)

ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken')

# List secrets
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets?application=app1&environment=NP"
```

3. **Search for secret**:

```bash
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets/search?q=database"
```

4. **Get secret details**:

```bash
# Get secret ID from list response
SECRET_ID="your-secret-id"

curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets/${SECRET_ID}"
```

5. **Update secret**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "NewSecretPassword456!"}' \
  "${API_ENDPOINT}secrets/${SECRET_ID}"
```

6. **Get console URL**:

```bash
curl -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets/${SECRET_ID}/console-url"
```

## Frontend Testing

### Test Frontend Deployment

1. Get the frontend URL:

```bash
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text
```

2. Open the URL in a browser

3. Test login with test users

4. Verify:
   - Login page loads
   - Authentication works
   - Secrets list displays
   - Search functionality works
   - User can only see secrets they have permission for
   - Create/update operations work (for users with write access)

## Troubleshooting

### Authentication Fails

Check user exists and password is correct:

```bash
aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username admin
```

### API Returns 401 Unauthorized

- Verify token is valid and not expired
- Check token is included in Authorization header
- Ensure user pool ID and client ID match

### API Returns 403 Forbidden

- User is authenticated but doesn't have permission
- Check user groups match the required permissions
- Verify Lambda authorizer is working correctly

### Lambda Errors

Check CloudWatch Logs:

```bash
# Get log group name
LOG_GROUP="/aws/lambda/SecretsPortalStack-Dev-ComputeSecretsFunction"

# View recent logs
aws logs tail "$LOG_GROUP" --follow
```

### DynamoDB Errors

Check table exists and has correct permissions:

```bash
# List tables
aws dynamodb list-tables

# Describe table
aws dynamodb describe-table --table-name secrets-metadata
```

## Performance Testing

### Load Test API

Use a tool like Apache Bench or `wrk`:

```bash
# Install wrk
brew install wrk  # macOS

# Load test
wrk -t4 -c100 -d30s \
  -H "Authorization: Bearer $ID_TOKEN" \
  "${API_ENDPOINT}secrets"
```

### Monitor Performance

Check CloudWatch metrics:

```bash
# API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=SecretsPortalApi \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## Cleanup

To remove test users:

```bash
# Delete a user
aws cognito-idp admin-delete-user \
  --user-pool-id "$USER_POOL_ID" \
  --username app1-dev
```

To remove test secrets:

```bash
# Delete from AWS Secrets Manager
aws secretsmanager delete-secret \
  --secret-id app1-np-test-database-password \
  --force-delete-without-recovery
```
