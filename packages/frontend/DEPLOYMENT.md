# Frontend Deployment Guide

This guide covers building and deploying the React frontend to AWS S3 and CloudFront.

## Prerequisites

- Infrastructure must be deployed first (see `packages/infrastructure/DEPLOYMENT.md`)
- AWS CLI configured with appropriate credentials
- Node.js 20.x or later

## Deployment Architecture

The frontend is deployed as a static website:
- **S3 Bucket**: Stores the built React application files
- **CloudFront**: CDN for fast global delivery with HTTPS
- **Origin Access Identity (OAI)**: Secures S3 bucket access

## Quick Deployment

### Automated Deployment (Recommended)

The `build-and-deploy.sh` script handles everything:

```bash
cd packages/frontend

# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

This script will:
1. Fetch configuration from CloudFormation stack outputs
2. Create `.env.production` file with correct values
3. Build the React application
4. Upload files to S3
5. Invalidate CloudFront cache
6. Display the frontend URL

## Manual Deployment

If you prefer manual control:

### 1. Get Stack Outputs

```bash
ENVIRONMENT=dev  # or staging, prod
STACK_NAME="SecretsPortalStack-${ENVIRONMENT^}"

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

# Get Cognito User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

# Get Cognito Client ID
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

# Get CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)
```

### 2. Create Environment File

Create `.env.production`:

```bash
cat > .env.production << EOF
VITE_API_ENDPOINT=$API_ENDPOINT
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_AWS_REGION=us-east-1
EOF
```

### 3. Build Frontend

```bash
npm run build
```

This creates optimized production files in the `dist/` directory.

### 4. Deploy to S3

```bash
aws s3 sync dist/ s3://$BUCKET_NAME/ --delete
```

The `--delete` flag removes old files that are no longer in the build.

### 5. Invalidate CloudFront Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*"
```

This ensures users get the latest version immediately.

### 6. Get Frontend URL

```bash
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text
```

## Local Development

For local development with the deployed backend:

### 1. Create `.env.local`

```bash
cp .env.example .env.local
```

### 2. Update with Stack Outputs

Get the values from your deployed stack and update `.env.local`:

```env
VITE_API_ENDPOINT=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
VITE_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_AWS_REGION=us-east-1
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Custom Domain Setup

To use a custom domain (e.g., `secrets.example.com`):

### 1. Create ACM Certificate

In **us-east-1** region (required for CloudFront):

```bash
aws acm request-certificate \
  --domain-name secrets.example.com \
  --validation-method DNS \
  --region us-east-1
```

### 2. Validate Certificate

Follow the DNS validation instructions in the ACM console.

### 3. Deploy with Custom Domain

Update `cdk.json` context:

```json
{
  "context": {
    "customDomain": "secrets.example.com",
    "certificateArn": "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID"
  }
}
```

Then redeploy the infrastructure:

```bash
cd packages/infrastructure
npm run deploy:prod
```

### 4. Update DNS

Add a CNAME record pointing to the CloudFront distribution:

```
secrets.example.com -> d111111abcdef8.cloudfront.net
```

## Troubleshooting

### Build Errors

If the build fails:

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Environment Variables Not Working

Ensure environment variables start with `VITE_` prefix. Vite only exposes variables with this prefix to the client.

### CloudFront Shows Old Version

CloudFront caching can take 5-15 minutes to propagate. To force immediate update:

```bash
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*"
```

### 404 Errors on Refresh

This is expected for SPAs. CloudFront is configured to return `index.html` for 404/403 errors, enabling client-side routing.

### CORS Errors

Ensure the API Gateway has CORS enabled for the CloudFront domain. This should be configured automatically by the infrastructure.

## CI/CD Integration

For automated deployments in CI/CD pipelines:

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Deploy (requires AWS credentials in environment)
cd packages/frontend
./build-and-deploy.sh ${ENVIRONMENT}
```

Set `ENVIRONMENT` variable in your pipeline to control the target environment.

## Performance Optimization

The deployment includes:
- **Gzip compression**: Enabled on CloudFront
- **Caching**: Optimized cache policies for static assets
- **CDN**: Global edge locations for fast delivery
- **Versioned assets**: Vite generates hashed filenames for cache busting

## Security

- S3 bucket is private (no public access)
- CloudFront uses OAI to access S3
- HTTPS enforced (HTTP redirects to HTTPS)
- Bucket versioning enabled for rollback capability
