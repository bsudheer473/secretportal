# Secrets Management Portal

A web-based application for managing AWS Secrets Manager secrets across multiple applications and environments with automated rotation tracking.

## Features

- **Centralized Secret Management**: Manage secrets for 6 applications across NP, PP, and Prod environments
- **Automated Rotation Tracking**: Configurable rotation periods (45/60/90 days) with email notifications
- **Role-Based Access Control**: Fine-grained permissions using AWS Cognito groups
- **Search and Filter**: Quick discovery of secrets by application, environment, or name
- **Audit Logging**: Complete audit trail of all secret access and modifications
- **AWS Console Integration**: Direct links to AWS Secrets Manager console

## Project Structure

This is a monorepo containing the following packages:

- `packages/shared-types` - Shared TypeScript types and interfaces
- `packages/backend` - Lambda function handlers for API operations
- `packages/frontend` - React web application with Material-UI
- `packages/infrastructure` - AWS CDK infrastructure definitions

## Quick Start

### Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Deploy Everything

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Deploy infrastructure
cd packages/infrastructure
cdk bootstrap  # First time only
./deploy.sh dev

# 4. Set up test users
./setup-cognito-users.sh dev

# 5. Deploy frontend
cd ../frontend
npm run deploy:dev

# 6. Get the frontend URL
aws cloudformation describe-stacks \
  --stack-name SecretsPortalStack-Dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text
```

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for all deployment commands.

## Documentation

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Complete deployment walkthrough
- **[Quick Reference](QUICK_REFERENCE.md)** - Common commands and tasks
- **[Infrastructure Deployment](packages/infrastructure/DEPLOYMENT.md)** - CDK deployment details
- **[Frontend Deployment](packages/frontend/DEPLOYMENT.md)** - Frontend build and deployment
- **[Testing Guide](packages/infrastructure/TESTING.md)** - Testing procedures
- **[Requirements](/.kiro/specs/secrets-manager-portal/requirements.md)** - Feature requirements
- **[Design](/.kiro/specs/secrets-manager-portal/design.md)** - Architecture and design
- **[Tasks](/.kiro/specs/secrets-manager-portal/tasks.md)** - Implementation tasks

## Architecture

```
Frontend (React) → CloudFront → API Gateway → Lambda → Secrets Manager
                                    ↓                      ↓
                                 Cognito              DynamoDB
```

### Components

- **Frontend**: React SPA with Material-UI, hosted on S3/CloudFront
- **API**: AWS API Gateway with Lambda integration
- **Authentication**: AWS Cognito with JWT tokens
- **Authorization**: Lambda authorizer with group-based permissions
- **Storage**: DynamoDB for metadata, AWS Secrets Manager for secrets
- **Notifications**: EventBridge + SNS for daily rotation checks

## Development

### Backend Development

```bash
cd packages/backend
npm run build
npm run lint
```

### Frontend Development

```bash
cd packages/frontend
npm run dev  # Start development server
npm run build  # Production build
```

### Infrastructure Development

```bash
cd packages/infrastructure
npm run build
npm run synth:dev  # Generate CloudFormation template
npm run diff:dev   # Preview changes
```

## Testing

### Test Authentication

```bash
cd packages/infrastructure
./test-authentication.sh dev admin Admin123!
```

### Test Lambda Functions

```bash
cd packages/backend
./verify-deployment.sh dev
```

See [TESTING.md](packages/infrastructure/TESTING.md) for comprehensive testing procedures.

## Test Users

After running `setup-cognito-users.sh`, the following test users are available:

| Username | Password | Access |
|----------|----------|--------|
| admin | Admin123! | Full access to all secrets |
| app1-dev | App1Dev123! | App1 NP/PP read/write |
| app1-viewer | App1View123! | App1 Prod read-only |
| app2-dev | App2Dev123! | App2 NP/PP read/write |
| app2-viewer | App2View123! | App2 Prod read-only |

## Environments

- **dev**: Development environment for testing
- **staging**: Pre-production environment
- **prod**: Production environment

Each environment has its own isolated stack and resources.

## Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/SecretsPortalStack-Dev-ComputeSecretsFunction --follow

# View API Gateway logs
aws logs tail /aws/apigateway/SecretsPortalApi --follow
```

### CloudWatch Metrics

Monitor in AWS Console:
- API Gateway: Request count, latency, errors
- Lambda: Invocations, duration, errors
- DynamoDB: Read/write capacity, throttles

## Security

- **Authentication**: AWS Cognito with JWT tokens
- **Authorization**: Group-based permissions (secrets-admin, app-developer, app-prod-viewer)
- **Encryption**: All secrets encrypted at rest (AWS Secrets Manager)
- **HTTPS**: CloudFront enforces HTTPS for all connections
- **Private S3**: Frontend bucket is private, accessed via CloudFront OAI
- **Audit Logging**: All secret access logged to DynamoDB

## Maintenance

### Update Infrastructure

```bash
cd packages/infrastructure
./deploy.sh dev
```

### Update Frontend

```bash
cd packages/frontend
npm run deploy:dev
```

### Cleanup

```bash
cd packages/infrastructure
npm run destroy:dev
```

## Troubleshooting

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#troubleshooting) for common issues and solutions.

## License

Proprietary
