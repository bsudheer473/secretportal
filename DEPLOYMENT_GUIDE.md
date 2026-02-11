# Secrets Management Portal - Complete Deployment Guide

This guide provides a complete walkthrough for deploying the Secrets Management Portal from scratch.

## Overview

The Secrets Management Portal is a full-stack application for managing AWS Secrets Manager secrets across multiple applications and environments. It includes:

- **Backend**: AWS Lambda functions for API operations
- **Frontend**: React SPA hosted on S3/CloudFront
- **Infrastructure**: AWS CDK for infrastructure as code
- **Authentication**: AWS Cognito for user management
- **Storage**: DynamoDB for metadata, AWS Secrets Manager for secrets

## Architecture

```
Frontend (React) → CloudFront → API Gateway → Lambda → Secrets Manager
                                    ↓                      ↓
                                 Cognito              DynamoDB
```

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (`aws configure`)
- Node.js 20.x or later
- AWS CDK CLI (`npm install -g aws-cdk`)
- Git

## Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd secrets-manager-portal

# Install dependencies
npm install
```

### 2. Build All Packages

```bash
npm run build
```

### 3. Bootstrap CDK (First Time Only)

```bash
cd packages/infrastructure
cdk bootstrap
```

### 4. Deploy Infrastructure

```bash
# Deploy to development environment
./deploy.sh dev

# Or deploy to other environments
./deploy.sh staging
./deploy.sh prod
```

This will deploy:
- DynamoDB tables (metadata and audit logs)
- Cognito User Pool and groups
- Lambda functions (auth, secrets CRUD, rotation checker)
- API Gateway with endpoints
- S3 bucket and CloudFront distribution for frontend
- EventBridge rule for daily rotation checks
- SNS topic for notifications

### 5. Set Up Test Users

```bash
./setup-cognito-users.sh dev
```

This creates test users for each application group.

### 6. Deploy Frontend

```bash
cd ../frontend
npm run deploy:dev
```

This will:
- Fetch configuration from CloudFormation
- Build the React application
- Upload to S3
- Invalidate CloudFront cache
- Display the frontend URL

### 7. Test Authentication

```bash
cd ../infrastructure
./test-authentication.sh dev admin Admin123!
```

### 8. Access the Application

Get the frontend URL:

```bash
aws cloudformation describe-stacks \
  --stack-name SecretsPortalStack-Dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text
```

Open the URL in your browser and log in with test credentials.

## Detailed Deployment Steps

### Infrastructure Deployment

See [packages/infrastructure/DEPLOYMENT.md](packages/infrastructure/DEPLOYMENT.md) for:
- Environment configuration
- CDK deployment options
- Environment variables
- Troubleshooting

### Lambda Functions

See [packages/backend/README.md](packages/backend/README.md) for:
- Lambda function architecture
- Build process
- Environment variables
- Testing

### Frontend Deployment

See [packages/frontend/DEPLOYMENT.md](packages/frontend/DEPLOYMENT.md) for:
- Build configuration
- S3/CloudFront setup
- Custom domain configuration
- Local development

### Testing

See [packages/infrastructure/TESTING.md](packages/infrastructure/TESTING.md) for:
- Authentication testing
- API endpoint testing
- Authorization testing
- End-to-end testing
- Performance testing

## Environment Configuration

### Development (dev)

- Stack Name: `SecretsPortalStack-Dev`
- Purpose: Development and testing
- Retention: Short-term
- Access: Developers

### Staging (staging)

- Stack Name: `SecretsPortalStack-Staging`
- Purpose: Pre-production testing
- Retention: Medium-term
- Access: QA and developers

### Production (prod)

- Stack Name: `SecretsPortalStack-Prod`
- Purpose: Production workloads
- Retention: Long-term
- Access: Limited to admins

## Post-Deployment Configuration

### 1. Configure Email Notifications

Update the SNS topic subscription:

```bash
# Get SNS topic ARN
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name SecretsPortalStack-Dev \
  --query "Stacks[0].Outputs[?OutputKey=='RotationTopicArn'].OutputValue" \
  --output text)

# Subscribe email
aws sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email
```

### 2. Create Production Users

For production, create real users instead of test users:

```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username john.doe \
  --user-attributes Name=email,Value=john.doe@company.com \
  --desired-delivery-mediums EMAIL

# Add to appropriate group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username john.doe \
  --group-name app1-developer
```

### 3. Configure Custom Domain (Optional)

See [packages/frontend/DEPLOYMENT.md](packages/frontend/DEPLOYMENT.md#custom-domain-setup) for:
- ACM certificate creation
- CloudFront configuration
- DNS setup

## Monitoring and Maintenance

### CloudWatch Logs

View Lambda logs:

```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/SecretsPortal

# Tail logs
aws logs tail /aws/lambda/SecretsPortalStack-Dev-ComputeSecretsFunction --follow
```

### CloudWatch Metrics

Monitor in AWS Console:
- API Gateway: Request count, latency, errors
- Lambda: Invocations, duration, errors
- DynamoDB: Read/write capacity, throttles

### Alarms

Set up CloudWatch alarms for:
- Lambda error rate > 5%
- API Gateway 5xx errors
- DynamoDB throttling
- Rotation checker failures

## Updating the Application

### Update Infrastructure

```bash
cd packages/infrastructure
./deploy.sh dev
```

CDK will automatically detect and apply changes.

### Update Lambda Functions

```bash
cd packages/backend
npm run build
cd ../infrastructure
./deploy.sh dev
```

### Update Frontend

```bash
cd packages/frontend
npm run deploy:dev
```

## Rollback

### Rollback Infrastructure

```bash
# View stack history
aws cloudformation describe-stack-events \
  --stack-name SecretsPortalStack-Dev

# Rollback to previous version
aws cloudformation cancel-update-stack \
  --stack-name SecretsPortalStack-Dev
```

### Rollback Frontend

S3 bucket versioning is enabled:

```bash
# List versions
aws s3api list-object-versions \
  --bucket secrets-portal-frontend-ACCOUNT-REGION

# Restore previous version
aws s3api copy-object \
  --copy-source bucket/key?versionId=VERSION_ID \
  --bucket bucket \
  --key key
```

## Cleanup

### Remove All Resources

```bash
# Destroy infrastructure
cd packages/infrastructure
npm run destroy:dev

# Note: S3 bucket is retained by default
# Manually delete if needed:
aws s3 rb s3://secrets-portal-frontend-ACCOUNT-REGION --force
```

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Error**
   ```bash
   cdk bootstrap aws://ACCOUNT/REGION
   ```

2. **Lambda Build Fails**
   ```bash
   cd packages/backend
   rm -rf dist node_modules
   npm install
   npm run build
   ```

3. **Frontend Build Fails**
   ```bash
   cd packages/frontend
   rm -rf dist node_modules
   npm install
   npm run build
   ```

4. **Authentication Fails**
   - Check Cognito user exists
   - Verify password is correct
   - Ensure user is in correct groups

5. **API Returns 403**
   - Check user has correct permissions
   - Verify Lambda authorizer is working
   - Check CloudWatch logs

### Getting Help

- Check CloudWatch Logs for detailed error messages
- Review [TESTING.md](packages/infrastructure/TESTING.md) for testing procedures
- Check AWS Console for resource status

## Security Best Practices

1. **Use Strong Passwords**: Change default test passwords
2. **Enable MFA**: For production Cognito users
3. **Rotate Credentials**: Regularly rotate secrets
4. **Monitor Access**: Review CloudWatch logs and audit logs
5. **Least Privilege**: Assign users to appropriate groups only
6. **HTTPS Only**: CloudFront enforces HTTPS
7. **Private S3**: Bucket is private, accessed via CloudFront OAI

## Cost Optimization

- Use appropriate Lambda memory sizes
- Enable DynamoDB auto-scaling
- Set CloudWatch log retention policies
- Use CloudFront caching effectively
- Delete unused secrets

## Support

For issues or questions:
1. Check documentation in each package
2. Review CloudWatch logs
3. Check AWS service health dashboard
4. Contact your AWS support team

## License

[Your License Here]
