# Deployment Guide

This guide covers deploying the Secrets Management Portal infrastructure to AWS using CDK.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 20.x or later
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Appropriate AWS permissions to create resources

## Environment Configuration

The infrastructure supports three environments:
- **dev**: Development environment
- **staging**: Staging/pre-production environment
- **prod**: Production environment

## Deployment Steps

### 1. Install Dependencies

From the project root:
```bash
npm install
```

### 2. Build All Packages

```bash
npm run build
```

### 3. Bootstrap CDK (First Time Only)

If this is your first time using CDK in your AWS account/region:
```bash
cd packages/infrastructure
cdk bootstrap
```

### 4. Deploy Infrastructure

#### Using the deployment script (recommended):
```bash
cd packages/infrastructure
./deploy.sh dev      # Deploy to development
./deploy.sh staging  # Deploy to staging
./deploy.sh prod     # Deploy to production
```

#### Using CDK commands directly:
```bash
cd packages/infrastructure

# Synthesize CloudFormation template
npm run synth:dev

# Preview changes
npm run diff:dev

# Deploy
npm run deploy:dev
```

### 5. Note the Outputs

After deployment, CDK will output important values:
- **ApiEndpoint**: The API Gateway URL
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **RotationTopicArn**: SNS Topic ARN for notifications

Save these values - you'll need them for frontend configuration.

## Environment Variables

### Infrastructure Deployment

Set these before deploying:
```bash
export CDK_DEFAULT_ACCOUNT=123456789012  # Your AWS account ID
export CDK_DEFAULT_REGION=us-east-1      # Your preferred region
export NOTIFICATION_EMAIL=admin@example.com  # Email for rotation notifications
```

### Lambda Functions

The following environment variables are automatically configured by CDK:
- `USER_POOL_ID`: Cognito User Pool ID
- `CLIENT_ID`: Cognito User Pool Client ID
- `SECRETS_METADATA_TABLE`: DynamoDB metadata table name
- `AUDIT_LOG_TABLE`: DynamoDB audit log table name
- `METADATA_TABLE_NAME`: DynamoDB metadata table name (rotation checker)
- `SNS_TOPIC_ARN`: SNS topic ARN for notifications

## Updating Infrastructure

To update an existing deployment:
```bash
cd packages/infrastructure
./deploy.sh [environment]
```

CDK will automatically detect changes and update only the modified resources.

## Destroying Infrastructure

To remove all infrastructure:
```bash
cd packages/infrastructure
npm run destroy:dev      # Destroy development
npm run destroy:staging  # Destroy staging
npm run destroy:prod     # Destroy production
```

**Warning**: This will delete all resources including DynamoDB tables and their data.

## Troubleshooting

### Build Errors

If you encounter build errors:
```bash
# Clean and rebuild
cd packages/shared-types && npm run build
cd ../backend && npm run build
cd ../infrastructure && npm run build
```

### CDK Errors

If CDK deployment fails:
1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify CDK bootstrap: `cdk bootstrap`
3. Check CloudFormation console for detailed error messages

### Permission Errors

Ensure your AWS credentials have permissions for:
- Lambda
- API Gateway
- DynamoDB
- Cognito
- Secrets Manager
- SNS
- EventBridge
- CloudWatch Logs
- IAM (for role creation)

## CI/CD Integration

For automated deployments, use the following commands in your pipeline:

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Deploy to environment
cd packages/infrastructure
npm run deploy:${ENVIRONMENT}
```

Set `ENVIRONMENT` variable in your CI/CD pipeline to control the target environment.
